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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var pg_1 = require("pg");
var bcryptjs_1 = require("bcryptjs");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var adminId, password, connectionString, ssl, normalized, url, pool, client, hash;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    adminId = process.argv[2];
                    password = process.argv[3];
                    if (!adminId || !password) {
                        console.error('Usage: tsx scripts/set-admin.ts <admin_id> <password>');
                        process.exit(1);
                    }
                    connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
                    ssl = process.env.PGSSLMODE === 'require' || (connectionString === null || connectionString === void 0 ? void 0 : connectionString.includes('sslmode=require'));
                    if (ssl) {
                        try {
                            pg_1.default.defaults.ssl = { rejectUnauthorized: false };
                        }
                        catch (_b) { }
                    }
                    normalized = connectionString;
                    try {
                        if (connectionString) {
                            url = new URL(connectionString);
                            url.searchParams.delete('sslmode');
                            normalized = url.toString();
                        }
                    }
                    catch (_c) { }
                    pool = connectionString
                        ? new pg_1.default.Pool({ connectionString: normalized, ssl: ssl ? { rejectUnauthorized: false } : undefined })
                        : new pg_1.default.Pool({
                            host: process.env.PGHOST,
                            port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
                            database: process.env.PGDATABASE,
                            user: process.env.PGUSER,
                            password: process.env.PGPASSWORD,
                            ssl: ssl ? { rejectUnauthorized: false } : undefined,
                        });
                    return [4 , pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 5, 7]);
                    return [4 , bcryptjs_1.default.hash(password, 12)];
                case 3:
                    hash = _a.sent();
                    return [4 , client.query("INSERT INTO admin_users (admin_id, name, password_hash) VALUES ($1, $1, $2)\n       ON CONFLICT (admin_id) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash", [adminId, hash])];
                case 4:
                    _a.sent();
                    console.log("Admin ".concat(adminId, " password updated"));
                    return [3 , 7];
                case 5:
                    client.release();
                    return [4 , pool.end()];
                case 6:
                    _a.sent();
                    return [7 ];
                case 7: return [2 ];
            }
        });
    });
}
main().catch(function (e) { console.error(e); process.exit(1); });
