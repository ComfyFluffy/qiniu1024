import { z } from "zod";
import { env } from "~/env.mjs";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { getVideos } from "~/server/lib/db/video";
import * as es from "~/server/lib/search/elasticsearch";
import * as gorse from "~/server/lib/gorse/base";
import { createUploadParameters } from "~/server/lib/util/upload";
import { GorseFeedback, type CommentPublic, type VideoPublic } from "~/types";

export const videoRouter = createTRPCRouter({
  uploadVideoFile: publicProcedure.mutation(() => {
    return createUploadParameters("video");
  }),

  uploadCoverFile: publicProcedure.mutation(() => {
    return createUploadParameters("cover");
  }),

  comments: publicProcedure
    .input(
      z.object({
        videoId: z.string(),
      }),
    )
    .query(async ({ input: { videoId }, ctx }): Promise<CommentPublic[]> => {
      const currentUserId = ctx.session?.userId;
      const comments = await ctx.db.comment.findMany({
        select: {
          id: true,
          text: true,
          createdAt: true,
          imgUrl: true,
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              likedUsers: true, // Count of all likes
              dislikedUsers: true, // Count of all dislikes
            },
          },
          likedUsers: {
            where: {
              id: currentUserId,
            },
            select: {
              id: true,
            },
          },
          dislikedUsers: {
            where: {
              id: currentUserId,
            },
            select: {
              id: true,
            },
          },
        },
        where: {
          videoId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return comments.map(
        ({ likedUsers, dislikedUsers, _count, ...comment }) => {
          const currentUser =
            currentUserId !== undefined
              ? {
                  liked: likedUsers.length > 0,
                  disliked: dislikedUsers.length > 0,
                }
              : null;
          return {
            ...comment,
            currentUser,
            likes: _count.likedUsers,
            dislikes: _count.dislikedUsers,
          };
        },
      );
    }),

  like: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
        like: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input: { videoId, like } }) => {
      if (like) {
        await ctx.db.like.create({
          data: {
            userId: ctx.session.userId,
            videoId,
          },
        });
        await gorse.insertFeedback(
          ctx.session.userId,
          videoId,
          GorseFeedback.LIKED,
        );
      } else {
        await ctx.db.like.delete({
          where: {
            userId_videoId: {
              userId: ctx.session.userId,
              videoId,
            },
          },
        });
        await gorse.deleteFeedback(
          ctx.session.userId,
          videoId,
          GorseFeedback.LIKED,
        );
      }
    }),

  extraMetadata: publicProcedure
    .input(
      z.object({
        videoId: z.string(),
      }),
    )
    .query(
      async ({
        ctx,
        input: { videoId },
      }): Promise<{
        currentUser: {
          liked: boolean;
          collected: boolean;
        } | null;
        likes: number;
        comments: number;
      }> => {
        let currentUser = null;
        if (ctx.session?.userId) {
          const liked = await ctx.db.like.count({
            where: {
              userId: ctx.session.userId,
              videoId,
            },
          });
          const collected = await ctx.db.collection.count({
            where: {
              videos: {
                some: {
                  id: videoId,
                },
              },
            },
          });
          currentUser = {
            liked: liked > 0,
            collected: collected > 0,
          };
        }
        const counts = await ctx.db.video.findUnique({
          where: {
            id: videoId,
          },
          select: {
            _count: {
              select: {
                comments: true,
                likes: true,
              },
            },
          },
        });
        if (counts === null) {
          throw new Error("Video not found");
        }

        return {
          currentUser,
          comments: counts._count.comments,
          likes: counts._count.likes,
        };
      },
    ),

  postComment: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
        text: z.string().min(1).max(1000),
        imgUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input: { videoId, text, imgUrl } }) => {
      await ctx.db.comment.create({
        data: {
          text,
          imgUrl,
          videoId,
          authorId: ctx.session.userId,
        },
      });
    }),

  deleteComment: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { commentId } }) => {
      await ctx.db.comment.delete({
        where: {
          id: commentId,
          authorId: ctx.session.userId,
        },
      });
    }),

  likeByUserId: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input: { userId } }): Promise<VideoPublic[]> => {
      return await ctx.db.video.findMany({
        where: {
          likes: {
            some: {
              userId: { equals: userId },
            },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        description: z.string().max(1000),
        coverFileKey: z.string().min(1),
        videoFileKey: z.string().min(1),
        tags: z.array(z.string().min(1)),
        category: z.string().min(1),
      }),
    )
    .mutation(
      async ({
        ctx,
        input: {
          title,
          description,
          coverFileKey,
          videoFileKey,
          category,
          tags,
        },
      }) => {
        const ossBaseUrl = `https://${env.NEXT_PUBLIC_ALIYUN_OSS_BUCKET}.${env.NEXT_PUBLIC_ALIYUN_OSS_REGION}.aliyuncs.com`;
        const coverUrl = `${ossBaseUrl}/${coverFileKey}`;
        const videoUrl = `${ossBaseUrl}/${videoFileKey}`;
        const video = await ctx.db.video.create({
          data: {
            title,
            description,
            coverUrl,
            url: videoUrl,
            authorId: ctx.session.userId,
            tags: {
              connectOrCreate: tags.map((tag) => ({
                where: {
                  name: tag,
                },
                create: {
                  name: tag,
                  type: "Tag",
                },
              })),
              connect: {
                name: category,
              },
            },
          },
          select: {
            id: true,
            tags: {
              select: {
                id: true,
                type: true,
              },
            },
          },
        });
        await es.insertVideo({
          id: video.id,
          title,
          description,
          tags,
        });
        await gorse.insertVideo(video.id, video.tags);
        return video.id;
      },
    ),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
      }),
    )
    .query(async ({ ctx, input: { query } }): Promise<VideoPublic[]> => {
      const videoIds = await es.searchVideo(query, {
        limit: 50,
      });
      const videos = await getVideos(ctx.db, videoIds);
      return videos;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { videoId } }) => {
      await ctx.db.video.delete({
        where: {
          id: videoId,
          authorId: ctx.session.userId,
        },
      });
    }),

  startedView: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { videoId } }) => {
      await ctx.db.history.upsert({
        create: {
          videoId,
          userId: ctx.session.userId,
        },
        update: {
          viewedAt: new Date(),
        },
        where: {
          userId_videoId: {
            userId: ctx.session.userId,
            videoId,
          },
        },
      });
      await gorse.insertFeedback(
        ctx.session.userId,
        videoId,
        GorseFeedback.READ,
      );
    }),

  finishedView: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { videoId } }) => {
      await gorse.insertFeedback(
        ctx.session.userId,
        videoId,
        GorseFeedback.READALL,
      );
    }),

  histories: protectedProcedure.query(
    async ({
      ctx,
    }): Promise<
      {
        video: VideoPublic;
        viewedAt: Date;
      }[]
    > => {
      const histories = await ctx.db.history.findMany({
        where: {
          userId: ctx.session.userId,
        },
        orderBy: {
          viewedAt: "desc",
        },
        take: 50,
        select: {
          viewedAt: true,
          video: {
            select: {
              id: true,
              title: true,
              views: true,
              coverUrl: true,
              createdAt: true,
            },
          },
        },
      });
      return histories;
    },
  ),

  deleteHistory: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { videoId } }) => {
      await ctx.db.history.delete({
        where: {
          userId_videoId: {
            userId: ctx.session.userId,
            videoId,
          },
        },
      });
    }),
});
