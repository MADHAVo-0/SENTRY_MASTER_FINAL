const axios = require('axios');

const token = process.env.GH_TOKEN;
const repo = 'MADHAVo-0/sentry-tracker';

if (!token) {
    console.log('No token provided');
    process.exit(1);
}

async function check() {
    try {
        console.log(`Checking access to ${repo}...`);
        const res = await axios.get(`https://api.github.com/repos/${repo}`, {
            headers: {
                Authorization: `token ${token}`,
                'User-Agent': 'node.js'
            }
        });
        console.log('Repo access successful!');
        console.log('Permissions:', res.data.permissions);
    } catch (error) {
        console.error('Error accessing repo:', error.response ? error.response.data : error.message);
    }
}

check();
