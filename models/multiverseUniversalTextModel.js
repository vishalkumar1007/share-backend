import mongoose from "mongoose";

const multiverseUniversalTextSchema = new mongoose.Schema({
    multiverseCode: {
        type: Number,
        required: true,
        unique: true
    },
    codeMappedText: {
        type: String,
        required: true
    }
}, { timestamps: true });

const multiverseUniversalTextModel = mongoose.model('multiverseUniversalText', multiverseUniversalTextSchema);
export default multiverseUniversalTextModel;
