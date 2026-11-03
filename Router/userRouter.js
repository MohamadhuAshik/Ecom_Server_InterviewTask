const express = require("express");
const {
  userSignup,
  userLogin,
  getUserProfile,
} = require("../Controller/userController");
const authentication = require("../middlewares/auth");

const userRouter = express.Router();

userRouter.post("/signup", userSignup);
userRouter.post("/login", userLogin);
userRouter.get("/profile", authentication, getUserProfile);

module.exports = userRouter;
