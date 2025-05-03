// const multiverseServerCode = require('./')
import { customAlphabet } from 'nanoid';
import multiverseUniversalTextModel from '../models/multiverseUniversalTextModel.js'

const allMultiverseCodeData = {};


const getAllMultiverseCodeWhenServerStart = async ()=>{
    try {
        const allCodeData = await multiverseUniversalTextModel.find({}, { multiverseCode: 1, _id: 0 });
        
        if(!allCodeData){
            return;
        }
        allCodeData.forEach((data)=>{
            allMultiverseCodeData[data.multiverseCode] = true;
        })
        
    } catch (error) {
        console.log('Error while get server multiverse Universal code ');
    }
}

getAllMultiverseCodeWhenServerStart();


const generateRandomMultiverseCode = async (len) => {
    try {
        // generate the multiverse code
        const generateCode = customAlphabet('1234567890',len)
        const multiverseCode = generateCode();
        if(!allMultiverseCodeData[multiverseCode]){
            allMultiverseCodeData[multiverseCode]=true;
            return multiverseCode;
        }
        
        for(let i=1;i<10_000;i++){
            const regenerateMultiverseCode = generateCode();
            if(!allMultiverseCodeData[regenerateMultiverseCode]){
                allMultiverseCodeData[multiverseCode]=true;
                return regenerateMultiverseCode;
            }
        }

        return 'server error'

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

        console.log('Data ',allMultiverseCodeData);
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