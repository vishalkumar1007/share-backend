import express from "express";
import {userSignUpController,userLoginController,userTokenValidation} from "../controllers/userController.js"


const userRouter = express.Router();

userRouter.post('/signup',userSignUpController);
userRouter.get('/login',userLoginController);
userRouter.get('/verifyUserAuthToken',userTokenValidation);

export default userRouter;