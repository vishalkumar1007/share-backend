import userModel from '../models/userModel.js';
import jwt from 'jsonwebtoken'

const userSignUpController = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        if (!firstName || !lastName || !email || !password) {
            console.log('user data must be required');
            return res.status(422).json({ msg: 'credentials required for signup ', responseStatus: 'failed' })
        }

        const findUserExistOrNotRes = await userModel.findOne({ email });


        if (findUserExistOrNotRes) {
            console.log('user already exist');
            return res.status(409).json({ msg: 'User already exist', responseStatus: 'failed' });
        }

        const userPayloadData = {
            firstName,  
            lastName,
            email,
            password
        }

        const createUserRes = await userModel.create(userPayloadData);

        if (!createUserRes) {
            console.log('Internal server error');
            return res.status(500).json({ msg: 'Internal server error', responseStatus: 'failed' });
        }

        const tokenPayload = {
            firstName,
            lastName,
            email
        }

        const tokenSecret = process.env.TOKEN_SECRET_KEY;
        const token = jwt.sign(tokenPayload, tokenSecret, { expiresIn: '31d' })

        res.status(201).json({ msg: 'new user registration successful', accessToken: token, responseStatus: 'success' });

    } catch (error) {
        console.log('Error while sign up user ', error);
        return res.status(500).json({ msg: 'Internal server error', responseStatus: 'failed' });
    }
}

const userLoginController = async (req, res) => {
    try {
        const { email, password } = req.query;

        if (!email || !password) {
            console.log('user data must be required');
            return res.status(422).json({ msg: 'credentials required for login ', responseStatus: 'failed' })
        }

        const findUserExistOrNotRes = await userModel.findOne({ email });

        if (!findUserExistOrNotRes) {
            console.log('user not found');
            return res.status(404).json({ msg: 'User Not Found', responseStatus: 'failed' });
        }

        const userPassword = findUserExistOrNotRes.password;

        if (userPassword != password) {
            return res.status(401).json({ msg: 'password incorrect', responseStatus: 'failed' });
        }


        const tokenPayload = {
            firstName: findUserExistOrNotRes.firstName,
            lastName: findUserExistOrNotRes.lastName,
            email: findUserExistOrNotRes.email
        }

        const tokenSecret = process.env.TOKEN_SECRET_KEY;
        const token = jwt.sign(tokenPayload, tokenSecret, { expiresIn: '31d' })

        return res.status(200).json({ msg: 'User login successfully', accessToken: token, payloadData: tokenPayload, responseStatus: 'failed' });

    } catch (error) {
        console.log('Error while sign up user ', error);
        return res.status(500).json({ msg: 'Internal server error', responseStatus: 'failed' });
    }
}


const userTokenValidation = (req,res)=>{
    try {
        console.log(req.headers.authorization);
        const token = req.headers.authorization?.split(' ')[1];

        if(!token){
            return res.status(422).json({msg:'auth token required',responseStatus:'failed'});
        }

        const decoded = jwt.verify(token , process.env.TOKEN_SECRET_KEY);

        console.log('decoded token : ',decoded);

        return res.status(200).json({msg:'token verification successful' , responseStatus:'success' , decode:decoded})

    } catch (error) {
        console.log('Error while validate the user token', error)
        return res.status(500).json({ msg: 'Internal server error', responseStatus: 'failed' });
    }
}
export { userSignUpController, userLoginController, userTokenValidation }