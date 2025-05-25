// const multiverseServerCode = require('./')
import cron from 'node-cron';
import { customAlphabet } from 'nanoid';
import multiverseUniversalTextModel from '../models/multiverseUniversalTextModel.js';
import userModel from '../models/userModel.js';
import jwt from 'jsonwebtoken';

let allMultiverseCodeData = {};

// fetch all multiverse code from db and push in the obj variable
const getAllMultiverseCodeWhenServerStart = async () => {
    try {
        const allCodeData = await multiverseUniversalTextModel.find({}, { multiverseCode: 1, _id: 0 });

        if (!allCodeData) {
            console.log('multiverse code empty in db while fetch data');
            return;
        }
        allCodeData.forEach((data) => {
            allMultiverseCodeData[data.multiverseCode] = true;
        })

        console.log('status 200 fetch : getAllMultiverseCodeWhenServerStart');

    } catch (error) {
        console.log('Error while get server multiverse Universal code ');
    }
}

// Generate the new multiverse code for users
const generateRandomMultiverseCode = async (len) => {
    try {
        const generateCode = customAlphabet('1234567890', len)
        const multiverseCode = generateCode();
        if (!allMultiverseCodeData[multiverseCode]) {
            allMultiverseCodeData[multiverseCode] = true;
            return multiverseCode;
        }

        // if duplicate found then try 10k time to find unique code 
        for (let i = 1; i < 10_000; i++) {
            const regenerateMultiverseCode = generateCode();
            if (!allMultiverseCodeData[regenerateMultiverseCode]) {
                allMultiverseCodeData[multiverseCode] = true;
                return regenerateMultiverseCode;
            }
        }

        return 'server error'

    } catch (error) {
        console.log('Error while generate the multiverse code', error)
        return 'server error';
    }
}

// Schedule to delete all multiverse code data from universal port db and allMultiverseCodeData
const deleteUniversalTextDataAfterOneDay = async () => {
    try {
        cron.schedule('1 0 * * *', async () => {
            // delete data from db
            const deleteMsg = await multiverseUniversalTextModel.deleteMany({});

            if (deleteMsg) {
                console.log('Schedule run universal text data delete from db ', deleteMsg);
            } else {
                console.log('Schedule run error while delete universal text data');
            }

            // delete data from server file
            try {
                allMultiverseCodeData = {};
                console.log('Schedule run universal text data delete from server storage');
            } catch (error) {
                console.log('Schedule run error while delete universal server file : ', error);
            }

        });

    } catch (error) {
        console.log('Error while delete universal data after one day');
    }
}

// API endpoint to save user text in universal port and give a unique multiverse code || also if api came with token then save the new data in user history history
const universalTextSave = async (req, res) => {
    try {
        const { textData } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        if (!textData) {
            return res.status(401).json({ msg: 'text data required', responseStatus: 'failed' });
        }

        const getMultiverseNewCode = await generateRandomMultiverseCode(6);
        if (getMultiverseNewCode === 'server error') {
            return res.status(500).json({ msg: 'error generating code' });
        }

        const newData = {
            multiverseCode: getMultiverseNewCode,
            codeMappedText: textData
        };

        const insertDataToDb = await multiverseUniversalTextModel.create(newData);
        if (!insertDataToDb) {
            return res.status(500).json({ msg: 'DB insert error', responseStatus: 'failed' });
        }

        let tokenVerification = 'unavailable';
        let textShareHistorySaveStatus = 'unavailable';

        // verify token function
        function verifyTokenAsync(token, secret) {
            return new Promise((resolve, reject) => {
                jwt.verify(token, secret, (err, decoded) => {
                    if (err) return reject(err);
                    resolve(decoded);
                });
            });
        }

        if (token) {
            try {
                const decoded = await verifyTokenAsync(token, process.env.TOKEN_SECRET_KEY);
                tokenVerification = 'success';

                const userEmailId = decoded.email;
                const saveResult = await userModel.updateOne(
                    { email: userEmailId },
                    { $push: { "activityHistory.textMultiverseData": newData } }
                );

                if (saveResult.modifiedCount > 0) {
                    textShareHistorySaveStatus = 'success';
                } else {
                    textShareHistorySaveStatus = 'failed';
                }
            } catch (err) {
                tokenVerification = 'failed';
                textShareHistorySaveStatus = 'failed';
            }
        }

        return res.status(200).json({
            code: getMultiverseNewCode,
            yourTextData: textData,
            responseStatus: 'success',
            tokenVerification,
            textShareHistorySaveStatus
        });
    } catch (error) {
        console.log('Error while save the text data in db', error)
        return res.status(500).json({ msg: 'internal server error', responseStatus: 'failed' })
    }
}

// * API endpoint to fetch the text from universal port using multiverse code .
const getUniversalTextData = async (req, res) => {
    try {
        const { multiverseCode } = req.query;

        if (!multiverseCode) {
            return res.status(401).json({ msg: 'multiverse code require', responseStatus: 'failed' })
        }

        if (multiverseCode.length != 6) {
            return res.status(401).json({ msg: 'Invalid multiverse code', responseStatus: 'failed' })
        }

        const multiverseTextData = await multiverseUniversalTextModel.findOne({ multiverseCode })


        if (!multiverseTextData) {
            console.log('code not found in db multiverse code base')
            return res.status(404).json({ msg: `Invalid multiverse Code ${multiverseCode}`, responseStatus: 'failed' })
        }

        res.status(200).json({ code: multiverseCode, responseStatus: 'success', codeMappedText: multiverseTextData.codeMappedText })

    } catch (error) {
        console.log('Internal server error in getUniversalTextData ', error)
        return res.status(500).json({ msg: 'Internal server error', responseStatus: 'failed' })
    }
}

export { getAllMultiverseCodeWhenServerStart, deleteUniversalTextDataAfterOneDay };
export { universalTextSave, getUniversalTextData };