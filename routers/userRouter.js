import express from "express";
import {userSignUpController,userLoginController,userTokenValidation,getUserDataController} from "../controllers/userController.js"
import {verifyUserTokenMiddleware} from '../middleware/verifyUserTokenMiddleware.js';
import { multiverseCustomPortRateLimit } from "../middleware/portRateLimitMiddleware.js";

const userRouter = express.Router();

userRouter.post('/signup',multiverseCustomPortRateLimit,userSignUpController);
userRouter.get('/login',multiverseCustomPortRateLimit,userLoginController);
userRouter.get('/getUserProfileData',multiverseCustomPortRateLimit,verifyUserTokenMiddleware,getUserDataController);

// without limit
userRouter.get('/verifyUserAuthToken',userTokenValidation);
export default userRouter;