import mongoose from "mongoose";

const multiverseUniversalTextSchema = new mongoose.Schema({
    multiverseCode :{
        type:Number,
        require:true,
        unique:true
    },
    codeMappedText:{
        type:String,
        require:true
    }
},{timestamps:true});

const multiverseUniversalTextModel = mongoose.model('multiverseUniversalText',multiverseUniversalTextSchema)
export default multiverseUniversalTextModel;