/* import the required modules */
import express from 'express';
import { config } from 'dotenv';
import ConnectDb from './connections/MongoDbconnection.js';
import {multiverseTextPort} from './controllers/universalTextController.js';

/* create app server */
const app = express();

/* configure env */
config();

/* connect to the db */
const mongoUrl = process.env.MONGO_URL;

ConnectDb(mongoUrl);

multiverseTextPort();

/* default router location */
app.get('/',(req,res)=>{
    res.json({note:'welcome to vishal server', serverStatus:'Server is live' ,apiRoutes:'/api',status:'running' })
})

/* getting Server PORT */
const PORT = process.env.PORT || 3001;

/* listening the server on port  */
app.listen(PORT , ()=>{
    console.log(`Server is running on PORT ${PORT}`);
})