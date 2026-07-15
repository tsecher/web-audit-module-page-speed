# PageSpeed (Web audit Module)

PageSpeed insights module for web-audit.

## Install
1. Install with your favorite package manager
2. Add the module in yout web-audit.config.js 
```
export const config = {
	modules: [
        ...
        'node_modules/web-audit-module-page-speed/src/modules/PageSpeedModule.js'
    ],
},
```
3. Get a page speed api Key from page speed insight api, and add it in uour web-audit.config.json : 
```
export const config = {
	...
    page_speed: {
        api_key: "your api key"
    }
```