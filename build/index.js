"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const querystring_1 = __importDefault(require("querystring"));
const cheerio_1 = require("cheerio");
axios_1.default.defaults.withCredentials = true;
axios_1.default.defaults.maxRedirects = 0;
const env = dotenv_1.default.config().parsed;
// get env from .env
const AUTH_DOMAIN = env.AUTH_DOMAIN;
const AUTH_PHASE1_URL = env.AUTH_PHASE1_URL;
const AUTH_PHASE2_URL = env.AUTH_PHASE2_URL;
const AUTH_PHASE3_URL = env.AUTH_PHASE3_URL;
const AUTH_PHASE4_URL = env.AUTH_PHASE4_URL;
const USERNAME = env.USERNAME;
const PASSWORD = env.PASSWORD;
console.log(`USERNAME: ${USERNAME}`);
console.log(`PASSWORD: ${PASSWORD}`);
const NBW_URL = env.NBW_URL;
const PUSHPLUS_TOKEN = env.PUSHPLUS_TOKEN;
const PUSHPLUS_TOPIC = env.PUSHPLUS_TOPIC;
axios_1.default.defaults.headers.common['Accept'] = '*/*';
axios_1.default.defaults.headers.common['Accept-Encoding'] = 'gzip, deflate';
axios_1.default.defaults.headers.common['Accept-Language'] = 'zh-CN,zh;q=0.9';
axios_1.default.defaults.headers.common['Connection'] = 'keep-alive';
axios_1.default.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.55';
axios_1.default.defaults.validateStatus = function (status) {
    return status >= 200 && status < 303;
};
function getAuth() {
    return __awaiter(this, void 0, void 0, function* () {
        let authn_lc_key = '';
        let authn_session = '';
        let seesion_id = '';
        let spAuthChainCode = '';
        return yield (0, axios_1.default)(AUTH_PHASE1_URL).then(res => {
            authn_lc_key = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
            seesion_id = res.headers['set-cookie'][1].split(';')[0].split('=')[1];
            return axios_1.default.get(res.headers.location, {
                headers: {
                    Cookie: `_idp_authn_lc_key_-_${AUTH_DOMAIN}=${authn_lc_key}; SESSION=${seesion_id}`
                }
            });
        }).then(res => {
            return axios_1.default.get(res.headers.location);
        }).then(res => {
            spAuthChainCode = res.data.match(/switchAuthTab\('1','(.*)'\);"/)[1];
            return (0, axios_1.default)({
                url: AUTH_PHASE2_URL,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    Cookie: `SESSION=${seesion_id}; _idp_authn_lc_key_-_${AUTH_DOMAIN}=${authn_lc_key}; x=x`,
                },
                data: querystring_1.default.stringify({
                    j_username: USERNAME,
                    j_password: PASSWORD,
                    j_checkcode: '验证码',
                    op: 'login',
                    spAuthChainCode
                })
            });
        }).then(res => {
            return (0, axios_1.default)({
                url: AUTH_PHASE3_URL,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Cookie: `SESSION=${seesion_id}; _idp_authn_lc_key_-_${AUTH_DOMAIN}=${authn_lc_key}; x=x`,
                },
            });
        }).then(res => {
            authn_session = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
            return (0, axios_1.default)({
                url: AUTH_PHASE4_URL,
                method: 'GET',
                headers: {
                    Cookie: `_idp_authn_lc_key_-_${AUTH_DOMAIN}=${authn_lc_key}; SESSION=${seesion_id}; _idp_session_-_${AUTH_DOMAIN}=${authn_session}`
                },
            });
        }).then(res => {
            return axios_1.default.get(res.headers.location, {
                proxy: false,
            });
        }).then(res => {
            return res.data.match(/<TwfID>(.*)<\/TwfID>/)[1];
        });
    });
}
function getNBW(twfid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield (0, axios_1.default)(NBW_URL, {
            headers: {
                Cookie: `TWFID=${twfid}`,
            }
        }).then(res => {
            const $ = (0, cheerio_1.load)(res.data);
            console.log('news parsed');
            const result = [];
            $('.list').each((index, element) => {
                if (index > 7)
                    return;
                const title = $(element).find('span').eq(0).text() + $(element).find('span').eq(1).text();
                const url = `https://nbw.sztu.edu.cn/${$(element).find('a').attr('href')}`;
                const date = $(element).find('span').eq(2).text();
                result.push({
                    title,
                    url,
                    date,
                });
            });
            return result;
        });
    });
}
const cachedNews = [];
function updateNews() {
    return __awaiter(this, void 0, void 0, function* () {
        const twfid = yield getAuth();
        console.log(`twfid: ${twfid}`);
        const news = yield getNBW(twfid);
        const updatedNews = [];
        news.forEach(news => {
            if (!cachedNews.find(cachedNews => cachedNews.url === news.url)) {
                updatedNews.push(news);
            }
        });
        const message = updatedNews.map(news => `${news.title}\n<a href='${news.url}'>${news.url}</a>\n${news.date}`).join('\n');
        if (message) {
            yield (0, axios_1.default)({
                url: 'https://www.pushplus.plus/send',
                method: 'POST',
                data: {
                    token: PUSHPLUS_TOKEN,
                    title: '公文通已更新',
                    content: `${new Date().toLocaleString('zh-Hans-CN', { timeZone: 'Asia/Shanghai' })}\n${message}`,
                    topic: PUSHPLUS_TOPIC,
                }
            }).then(res => {
                console.log('message pushed');
                console.log(res.data);
            });
        }
        if (updateNews.length !== 0)
            console.log(`update news ${updateNews.length}`);
    });
}
// startup update
updateNews();
// update every 30 minutes
setInterval(updateNews, 1000 * 60 * 30);
