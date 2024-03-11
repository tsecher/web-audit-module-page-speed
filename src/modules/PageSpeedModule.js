import {AbstractPuppeteerJourneyModule} from 'web_audit/dist/journey/AbstractPuppeteerJourneyModule.js';
import {PuppeteerJourneyEvents} from 'web_audit/dist/journey/AbstractPuppeteerJourney.js';
import {ModuleEvents} from 'web_audit/dist/modules/ModuleInterface.js';

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

	contextsData = {};

	/**
	 * {@inheritdoc}
	 */
	async init(context) {
		this.context = context;
		// Install Page Speed store.
		this.context.config.storage?.installStore('page_speed', this.context, {
			url: 'Url',
			context: 'Context',
			'first-contentful-paint-ms': 'First Contentful Paint MS',
			'first-input-delay-ms': 'First Input Delay MS',
			'first-contentful-paint': 'First Contentful Paint',
			'speed-index': 'Speed Index',
			'interactive': 'Time To Interactive',
			'first-meaningful-paint': 'First Meaningful Paint',
			'first-cpu-idle': 'First CPU Idle',
			'estimated-input-latency': 'Estimated Input Latency',
		});

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
		this.context?.config?.logger.result(`Page Speed`, eventData.result, urlWrapper.url.toString());
		this.context?.config?.storage?.add('page_speed', this.context, eventData.result);
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
		const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}`;
		const response = await fetch(api);
		const json = await response.json();

		if (json?.lighthouseResult?.audits['first-contentful-paint']?.displayValue) {
			return {
				'first-contentful-paint-ms': json.loadingExperience?.metrics?.FIRST_CONTENTFUL_PAINT_MS?.category || '',
				'first-input-delay-ms': json.loadingExperience?.metrics?.FIRST_INPUT_DELAY_MS?.category || '',
				'first-contentful-paint': json.lighthouseResult?.audits['first-contentful-paint']?.numericValue  || '',
				'speed-index': json.lighthouseResult?.audits['speed-index']?.numericValue  || '',
				'interactive': json.lighthouseResult?.audits['interactive']?.numericValue  || '',
				'first-meaningful-paint': json.lighthouseResult?.audits['first-meaningful-paint']?.numericValue  || '',
				'first-cpu-idle': json.lighthouseResult?.audits['first-cpu-idle']?.numericValue  || '',
				'estimated-input-latency': json.lighthouseResult?.audits['estimated-input-latency']?.numericValue  || '',
			}
		}
		return null;
	}

}
