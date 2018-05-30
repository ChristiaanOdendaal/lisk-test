# Ripple integration for ChainEX

Steps to run:

1. Run sudo apt install build-essential libzmq5-dev command
2. Run `npm install` command
3. cp configuration-sample.ts configuration.ts
4. Edit configuration.ts
5. cp ormconfig-sample.ts ormconfig.ts
6. Edit ormconfig.json
7. Run `npm run compile` command
8. Add the following Cron jobs:
```
* * * * *   <username>    cd /path/to/xrp_api/dist && node src/index.js balance
* * * * *   <username>    cd /path/to/xrp_api/dist && node src/index.js deposit
* * * * *   <username>    cd /path/to/xrp_api/dist && node src/index.js withdraw
```