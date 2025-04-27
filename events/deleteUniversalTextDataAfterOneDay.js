import cron from 'node-cron';
import multiverseUniversalTextModel from '../models/multiverseUniversalTextModel.js';
import {writeFile} from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '../multiverseUniversalCode.json');

const deleteUniversalTextDataAfterOneDay = async ()=>{
    try {
        cron.schedule('0 0 * * *',async ()=>{
            // delete data from db
            const deleteMsg = await multiverseUniversalTextModel.deleteMany({});
            if(deleteMsg){
                console.log('Schedule run universal text data delete from db');
            }else{
                console.log('Schedule run error while delete universal text data');
            }

            // delete data from server file
            try {
                writeFile(filePath,JSON.stringify({},null,2),'utf-8');
                console.log('Schedule run universal text data delete from server file');
            } catch (error) {
                console.log('Schedule run error while delete universal server file : ' ,error);
            }

        });

    } catch (error) {
        console.log('Error while delete universal data after one day');
    }
}

export default deleteUniversalTextDataAfterOneDay;