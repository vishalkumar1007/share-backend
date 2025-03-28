/* import the required modules */
const express = require('express');
const dotenv = require('dotenv');

/* create app server */
const app = express();

/* configure env */
dotenv.config();

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