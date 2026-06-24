import {AbstractPuppeteerJourneyModule} from 'web_audit/dist/journey/AbstractPuppeteerJourneyModule.js';
import {PuppeteerJourneyEvents} from 'web_audit/dist/journey/AbstractPuppeteerJourney.js';
import {ModuleEvents} from 'web_audit/dist/modules/ModuleInterface.js';
import schema from "./page-speed.schema.json" with {type: "json"};
import fs from "fs";

/**
 * Page Speed Module events.
 */
export const PageSpeedModuleEvents = {
	createPageSpeedModule: 'page_speed_module__createPageSpeedModule',
	beforeAnalyse: 'page_speed_module__beforeAnalyse',
	onResult: 'page_speed_module__onResult',
	onResultDetail: 'page_speed_module__onResultDetail',
	afterAnalyse: 'page_speed_module__afterAnalyse',
};

/**
 * Page Speed.
 */
export default class PageSpeedModule extends AbstractPuppeteerJourneyModule {
	get name() {
		return 'Page Speed';
	}

	get id() {
		return `page_speed`;
	}

	getSchema() {
		return schema;
	}

	contextsData = {};

	/**
	 * {@inheritdoc}
	 */
	async init(context) {
		this.context = context;
		// Install Page Speed store.
		this.context.config.storage?.installSchema(this, this.context);

		// Emit.
		this.context.eventBus.emit(PageSpeedModuleEvents.createPageSpeedModule, {module: this});
	}

	/**
	 * {@inheritdoc}
	 */
	initEvents(journey) {
		journey.on(PuppeteerJourneyEvents.JOURNEY_START, async (data) => {
			this.contextsData = {};
		});
		journey.on(PuppeteerJourneyEvents.JOURNEY_NEW_CONTEXT, async (data) => {
			this.contextsData[data.name] = await this.getContextData(data);
		});
	}

	/**
	 * Return context data
	 */
	async getContextData(data) {
		return data.wrapper.page.url();
	}

	/**
	 * {@inheritdoc}
	 */
	async analyse(urlWrapper) {
		this.context?.eventBus.emit(ModuleEvents.startsComputing, {module: this});
		for (const contextName in this.contextsData) {
			if (contextName) {
				await this.analyseContext(contextName, urlWrapper);
			}
		}
		this.context?.eventBus.emit(ModuleEvents.endsComputing, {module: this});
		return true;
	}


	/**
	 * Analyse a context.
	 *
	 * @param {string} contextName
	 * @param {UrlWrapper} urlWrapper
	 */
	async analyseContext(contextName, urlWrapper) {

		const eventData = {
			module: this,
			url: urlWrapper,
		};
		this.context?.eventBus.emit(PageSpeedModuleEvents.beforeAnalyse, eventData);
		this.context?.eventBus.emit(ModuleEvents.beforeAnalyse, eventData);


		// Get Page speed data.
		const data = await this.getResults(this.contextsData[contextName]);

		// Event data.
		eventData.result = {
			url: urlWrapper.url.toString(),
			context: contextName,
			...data
		};
		this.context?.eventBus.emit(PageSpeedModuleEvents.onResult, eventData);

		// Main
		const mainIndicators = this.filterMainIndicators(eventData.result);
		this.context?.config?.logger.result(`Page Speed`, mainIndicators, urlWrapper.url.toString());
		this.context?.eventBus.emit('onAnalyseSummary', {module: this, group_id:`lighthouse` , url: urlWrapper, summary: mainIndicators});
		this.context?.config?.storage?.add(this, 'page_speed', this.context, mainIndicators);
		this.context?.config?.storage?.add(this, 'page_speed_details', this.context, eventData.result);
		this.context?.eventBus.emit(ModuleEvents.afterAnalyse, eventData);
		this.context?.eventBus.emit(PageSpeedModuleEvents.afterAnalyse, eventData);
	}

	/**
	 * Return results.
	 *
	 * @param url
	 * @returns {Promise<{"first-input-delay-ms": (string|*), "first-contentful-paint": (*|string), "first-contentful-paint-ms": (string|*), "speed-index": (*|string), "first-cpu-idle": (*|string), "estimated-input-latency": (*|string), "first-meaningful-paint": (*|string), interactive: (*|string)}|null>}
	 */
	async getResults(url) {
		if (typeof this.context.config?.AppConfig?.config?.page_speed?.api_key === 'undefined') {
			this.context.config.logger.error(`You need to define a page speed api key in the web-audit.config.json ("page_speed": {"api_key": "..."})`)
			process.exit;
		}

		const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${this.context.config.AppConfig.config.page_speed.api_key}`;
		const response = await fetch(api);
		const json = await response.json();


		if (json?.lighthouseResult?.audits['first-contentful-paint']?.displayValue) {
			const audits = json.lighthouseResult?.audits;

			fs.writeFileSync('test.json', JSON.stringify(audits), 'utf-8');

			const result = {};
			Object.keys(audits).forEach(indicator => {
				result[indicator] = audits[indicator].numericValue || '';
				result[indicator + '-score'] = audits[indicator].score || '';
			})

			return result;
		}
		return null;
	}

	/**
	 * Filters main indicators;
	 */
	filterMainIndicators(allResults) {
		const main = {};
		[
			"url",
			"context",
			"speed-index",
			"largest-contentful-paint",
			"cumulative-layout-shift",
			"first-contentful-paint",
			"server-response-time"
		].forEach(indicator => {
			main[indicator] = allResults[indicator]
			main[`${indicator}-score`] = allResults[`${indicator}-score`]
		})

		return main;
	}

}
