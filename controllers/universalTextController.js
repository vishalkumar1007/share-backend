// const multiverseServerCode = require('./')
import {customAlphabet} from 'nanoid';


const generateRandomMultiverseCode = (len)=>{
    try {
        const generateCode   = customAlphabet('1234567890',len);
        const code = generateCode();
        if(code.length===len){
            return code ;
        }
        // if nanoid not able to generate the code then default code work
        let multiversecodeLen = 1;
        let multiversecodeLenEnd = 9;
        for(let i=1;i<len;i++){
            multiversecodeLen *= 10;
            multiversecodeLenEnd *= 10;
        }
        return Math.floor( multiversecodeLen + Math.random()*multiversecodeLenEnd).toString();
    } catch (error) {
        console.log('Error while generate the multiverse code')
    }
}



const multiverseTextPort = (req,res)=>{
    try {
        // const {textData} = req.query;
        // if(!textData){
        //     res.status(401).json({msg:'text data require',success:fail});
        //     return;
        // }

        const getMultiverseNewCode = generateRandomMultiverseCode(6);


    } catch (error) {
        console.log('Error while save the text data in db')
    }
}


export {multiverseTextPort};