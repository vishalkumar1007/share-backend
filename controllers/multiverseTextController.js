// const multiverseServerCode = require('./')
import { customAlphabet } from 'nanoid';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import multiverseUniversalTextModel from '../models/multiverseUniversalTextModel.js'

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '../multiverseUniversalCode.json');


const generateRandomMultiverseCode = async (len) => {
    try {
        // Check if file exists
        if (!existsSync(filePath)) {
            console.log('File not found, creating a new one...');
            await writeFile(filePath, JSON.stringify({}, null, 2), 'utf-8');

            // write code to  delete the data from universal text data
            const delete_response = await multiverseUniversalTextModel.deleteMany({});

            if(!delete_response){
                console.log('db data not deleted major bug');
                return 'server error';
            }
            console.log('db all data delete successfully')
        }

        // get the multiverse data 
        let multiverseServerCodefile = await readFile(filePath, 'utf-8');

        
        // If file is empty or only spaces, reset it to '{}'
        if (!multiverseServerCodefile.trim()) {
            console.log('Empty file found, writing {} into it...');
            await writeFile(filePath, JSON.stringify({}, null, 2), 'utf-8');
            multiverseServerCodefile = '{}';  
        }

        const multiverseServerData = JSON.parse(multiverseServerCodefile);
        

        // generate the multiverse code 
        const generateCode = customAlphabet('1234567890', len);
        
        // generate 6 digit multiverse code but if lyb fail then try with manual
        const generateMultiverseCodeCode = ()=>{
            const  multiverseCode = generateCode();
            
            if (multiverseCode.length === len) {
                return multiverseCode;
            }
            
            console.log('nano id not able to generate the 6 digit code -> try to manually generate');
            let multiversecodeLen = 1;
            let multiversecodeLenEnd = 9;
            for (let i = 1; i < len; i++) {
                multiversecodeLen *= 10;
                multiversecodeLenEnd *= 10;
            }
            return Math.floor(multiversecodeLen + Math.random() * multiversecodeLenEnd).toString();
        }
        
        let code = generateMultiverseCodeCode();
        
        // give another chance to make 6 digit code
        if(code.length!==len){
            code = generateMultiverseCodeCode();
        }
        
        if(code.length!==len){
            return 'server error';
        }
        
        // if nanoid not able to generate the code then default code work
        
        
        if (multiverseServerData[code]) {
            for (let i = 1; i < 10_001; i++) {
                const regenerate_code = generateMultiverseCodeCode();
                
                if(regenerate_code.length!==len){
                    console.log('length not matched')
                    return 'server error';
                }
                
                console.log(`regenerate code : ${regenerate_code}`);
                if (!multiverseServerData[regenerate_code]) {
                    console.log(`unique regenerate code found : ${regenerate_code}`);
                    code = regenerate_code;
                    break;
                }
                
                if (i === 10_000) {
                    console.log('no new code found');
                    return 'server error';
                }
            }
        }

        const data = {
            ...multiverseServerData, [code]: true
        }

        await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8'); 

        return code;

    } catch (error) {
        console.log('Error while generate the multiverse code', error)
        return 'server error';
    }
}


const universalTextSave = async (req, res) => {
    try {
        const { textData } = req.body;

        if (!textData) {
            console.log('text data required 401');
            return res.status(401).json({ msg: 'text data require', responseStatus: 'failed' });
        }

        const getMultiverseNewCode = await generateRandomMultiverseCode(6);
        
        if (getMultiverseNewCode === 'server error') {
            return res.status(500).json({ msg: 'Internal server error while multiverse code generate', code: getMultiverseNewCode })
        }


        const newData = {
            multiverseCode:getMultiverseNewCode,
            codeMappedText:textData
        }
        const insertDataToDb = await multiverseUniversalTextModel.create(newData);

        if(!insertDataToDb){
            console.log('error while insert data in db');
            return res.status(500).json({msg:'Internal server error',responseStatus:'failed'});
        }
        


        res.status(200).json({ code: getMultiverseNewCode , yourTextData : textData , responseStatus:'success' })

    } catch (error) {
        res.status(500).json({ msg: 'internal server error', responseStatus: 'failed' })
        console.log('Error while save the text data in db')
    }
}

const getUniversalTextData = async (req,res)=>{
    try {
        const {multiverseCode} = req.query;

        if(!multiverseCode){
            return res.status(401).json({msg:'multiverse code require',responseStatus:'failed'})
        }
        
        if(multiverseCode.length!=6){
            return res.status(401).json({msg:'Invalid multiverse code',responseStatus:'failed'})
        }        
        
        const multiverseTextData = await multiverseUniversalTextModel.findOne({multiverseCode})
        
        
        if(!multiverseTextData){
            console.log('code not found in db multiverse code base')
            return res.status(404).json({msg:`Invalid multiverse Code ${multiverseCode}`,responseStatus:'failed'})
        }
        
        res.status(200).json({code:multiverseCode ,responseStatus:'success', codeMappedText:multiverseTextData.codeMappedText})

    } catch (error) {
        console.log('Internal server error in getUniversalTextData ', error)
        return res.status(500).json({msg:'Internal server error',responseStatus:'failed'})
    }
}

export { universalTextSave , getUniversalTextData};