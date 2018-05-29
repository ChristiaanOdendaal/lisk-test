# Ripple integration for ChainEX

Steps to run:

1. Run `npm install` command
2. cp configuration-sample.ts configuration.ts
3. Edit configuration.ts
4. cp ormconfig-sample.ts ormconfig.ts
5. Edit ormconfig.json
6. Run `npm run compile` command
7. Add the following Cron jobs:
```
* * * * *   <username>    cd /path/to/xrp_api/dist && node src/index.js address
* * * * *   <username>    cd /path/to/xrp_api/dist && node src/index.js deposit
* * * * *   <username>    cd /path/to/xrp_api/dist && node src/index.js clearing
```