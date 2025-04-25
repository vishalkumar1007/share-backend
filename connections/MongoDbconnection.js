import { connect } from 'mongoose';

const ConnectDb = async (dbUrl)=>{
    try {
        const response = await connect(dbUrl);
        if(!response){
            console.log(`mongodb connection Failed` )
            return;
        }
        console.log(`mongodb connection successfully`)

    } catch (error) {
        console.log(`error while connecting db ${error}`)
    }

}

export default ConnectDb;