/* import the required modules */
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import ConnectDb from './connections/MongoDbconnection.js';
import TextMultiverseRoute from './routers/TextMultiverseRoute.js';
import deleteUniversalTextDataAfterOneDay from './events/deleteUniversalTextDataAfterOneDay.js';

/* create app server */
const app = express();
app.use(express.json());


/* configure env */
config();

/* Cors policies */
const allowedOrigins = ['http://localhost:5173','https://vishalkumar1007.github.io'];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}))

/* connect to the db */
const mongoUrl = process.env.MONGO_URL;

ConnectDb(mongoUrl);

/* Delete multiverse universal text data at every day 12am */
deleteUniversalTextDataAfterOneDay();


/* default router location */
app.get('/',(req,res)=>{
    res.json({note:'welcome to vishal server', serverStatus:'Server is live' ,apiRoutes:'/api',status:'running' })
})

/* Api Endpoint */
app.use('/api/TextMultiverse',TextMultiverseRoute)

/* getting Server PORT */
const PORT = process.env.PORT || 3001;

/* listening the server on port  */
app.listen(PORT , ()=>{
    console.log(`Server is running on PORT ${PORT}`);
})