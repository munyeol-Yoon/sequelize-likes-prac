const express = require("express");
const authmiddleware = require("../middlewares/auth-middleware");

const { Posts, Users, Likes, sequelize } = require("../models");
const { Op } = require("sequelize");
const { postCUDApiLimiter } = require("../middlewares/rate-limit");

const router = express.Router();

// 게시글 좋아요
router.put(
  "/:postId/like",
  authmiddleware,
  postCUDApiLimiter,
  async (req, res) => {
    const { postId } = req.params;
    const { userId } = res.locals.user;

    const findPost = await Posts.findOne({
      where: { postId },
    });
    if (!findPost) {
      return res
        .status(404)
        .json({ errorMessage: "게시글을 찾을 수 없습니다." });
    }

    const findUser = await Users.findOne({
      where: { userId },
    });
    if (!findUser) {
      return res
        .status(404)
        .json({ errorMessage: "유저를 찾을 수 없습니다. " });
    }

    const existLike = await Likes.findOne({
      where: {
        [Op.and]: [{ postId }, { userId }],
      },
    });

    try {
      if (existLike) {
        await Likes.destroy({
          where: {
            [Op.and]: [{ postId }, { userId }],
          },
        });
        return res
          .status(200)
          .json({ message: "게시글 좋아요를 취소하였습니다. " });
      }
      await Likes.create({
        postId,
        userId,
      });
      return res
        .status(200)
        .json({ message: "게시글 좋아요를 성공하였습니다." });
    } catch (err) {
      console.error(err);
    }
  }
);

// 좋아요 게시글 조회
router.get("/like", authmiddleware, async (req, res) => {
  try {
    const { userId } = res.locals.user;

    const findLikes = await Posts.findAll({
      where: { userId },
      attributes: ["postId", "userId", "title", "createdAt", "updatedAt"],
      include: [
        {
          model: Users,
          attributes: ["nickname"],
        },
        {
          model: Likes,
          attributes: [
            [sequelize.fn("count", sequelize.col("Likes.postId")), "likes"],
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      group: ["postId"],
      raw: true,
    });
    console.log(findLikes);

    const data = findLikes.map((like) => {
      return {
        postId: like.postId,
        userId: like.userId,
        nickname: like["User.nickname"],
        title: like.title,
        createdAt: like.createdAt,
        updatedAt: like.updatedAt,
        likes: like["Likes.likes"],
      };
    });

    const sortedData = data.sort((a, b) => b["likes"] - a["likes"]);

    if (!data) {
      return res.status(404).json({ errorMessage: "좋아요 없습니다." });
    }

    return res.status(200).json({ posts: sortedData });
  } catch (err) {
    console.error(err);
  }
});

module.exports = router;
