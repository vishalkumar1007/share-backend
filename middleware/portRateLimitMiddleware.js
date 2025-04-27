import cron from 'node-cron';

const visitedIpObj = {};


const multiverseCustomPortRateLimit = (req,res,next)=>{
    try {
        let ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.ip;

        if (ip === '::1') {
            ip = '127.0.0.1';
        }
        const time = Date.now();
        const rateLimitDelay = 5 * 60 * 1000;
        const allowApiRequest = 50;

        if(!visitedIpObj[ip]){
            visitedIpObj[ip] = {count:1,time}
        }else{
            if(rateLimitDelay>(time - visitedIpObj[ip].time)){
                visitedIpObj[ip].count++;
            }else{
                visitedIpObj[ip] = {count:1,time}
            }
        }

        if(allowApiRequest<visitedIpObj[ip].count){
            console.log('Rate limit exceeded');
            return res.status(429).json({ msg: 'Too many requests', responseStatus: 'failed' });
        }

        next();

    } catch (error) {
        console.log('Internal server error in multiversePortRateLimit');
        res.status(500).json({msg:'internal server error , api rate limit' , responseStatus:'failed'});
    }
}

// if this file is ot in use then this alway run , handel it


try {
    cron.schedule('0 0 * * 1',()=>{
        if(!visitedIpObj){
            return;
        }
    
        const time = Date.now();
        const rateLimitDelay = 5 * 60 * 1000;
        for (const storedIp in visitedIpObj) {
            if ((time - visitedIpObj[storedIp].time) > rateLimitDelay) {
                delete visitedIpObj[storedIp];
            }
        }
        console.log('Old IPs cleaned from visitedIpObj using schedular!');
    });
} catch (error) {
    console.log('Error in old IPs cleaned schedular every monday!');
}

export {multiverseCustomPortRateLimit};
