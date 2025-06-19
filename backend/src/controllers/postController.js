import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Likes from "../models/Likes.js";
import axios from "axios";
import Notification from "../models/Notification.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const createPost = async (req, res) => {
  const { content, userId, username } = req.body;
  console.log(req.body);

  let postedBy = {
    _id: userId,
    username: username,
  };

  try {
    const post = new Post({
      content,
      postedBy,
      image: req.file ? req.file.filename : null,
    });
    await post.save();
    const populatedPost = await Post.findById(post._id)
      .populate("postedBy", "username profileImage")
      .exec();
    const notification = new Notification({
      userId: userId,
      message: "Your post has been successfully created!",
    });
    await notification.save();
    const io = req.app.get("io");

    io.emit("newPost", {
      message: "Your post has been successfully created!",
      post: post,
    });

    res.status(201).json(populatedPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("postedBy", "username profileImage ")
      .populate({
        path: "comments",
        populate: {
          path: "commentedBy",
          select: "username profileImage",
        },
      })
      .populate("likes")
      .sort({ createdAt: -1 });

    const postsWithLikes = posts.map((post) => ({
      ...post.toObject(),
      likesCount: post.likes.length,
      hasLiked: req.user
        ? post.likes.some((like) => like.userId.toString() === req.user.id)
        : false,
    }));
    res.json(postsWithLikes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
export const deletePost = async (req, res) => {
  const id = req.params.id;
  try {
    await Post.findByIdAndDelete(id);
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
export const getPost = async (req, res) => {
  try {
    id = req.body;
    const post = await Post.findById(id)
      .populate("postedBy", "username")
      .populate("comments.commentedBy", "username")
      .populate("likes", "username");
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
export const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const existingLike = await Likes.findOne({ postId, userId });
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (existingLike) {
      await Likes.deleteOne({ postId, userId });
      await Post.findByIdAndUpdate(postId, {
        $pull: { likes: existingLike._id },
      });
    } else {
      const like = await Likes.create({ postId, userId });
      await Post.findByIdAndUpdate(postId, { $push: { likes: like._id } });
      const notification = new Notification({
        userId: userId,
        message: "Your post was liked by the user " + req.user.username,
      });
      await notification.save();
      const io = req.app.get("io");
      // Emit a socket event to the post owner
      io.to(post.postedBy.toString()).emit("notification", {
        message: `Your post was liked by user ${req.user.username}`,
        postId,
      });
    }
    const likesCount = await Likes.countDocuments({ postId });
    const hasLiked = !!(await Likes.findOne({ postId, userId }));
    res.json({ postId, likesCount, hasLiked });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updatePost = async (req, res) => {
  const id = req.params.id;
  const { content } = req.body;
  try {
    const post = await Post.findByIdAndUpdate(id, { content });

    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const rewritePost = async (req, res) => {
  const { content } = req.body;
  console.log(content);
  console.log(process.env.GEMINI_API_KEY);
  if (!content.trim()) {
    return res.status(400).json({ message: "Content is required" });
  }
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Rewrite this social media post in a more engaging and creative way:\n\n"${content} dont give markdown output also give one answer.`;
    const result = await model.generateContent(prompt);
    const rewrittenContent =
      result.response.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join(" ") || "Failed to generate response";

    console.log(rewrittenContent);

    res.json({ rewrittenContent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
