import { ActivitiesOptions, ActivityType, Locale } from "discord.js";
import Keyv from "keyv";

const mapsCache = new Keyv({
	namespace: "maps",
});

export const ACTIVITIES: ActivitiesOptions[] = [
	{ name: "Custom Game", type: ActivityType.Playing },
]; //Discord上に表示されるステータス
export const TEAMS = 2; //チーム分けのチーム数

export const getMap = async (locale: Locale): Promise<string | undefined> => {
	const lang = locale;
	const cached = await mapsCache.get(lang);
	const data = cached ?? {}; //API等からのデータ
	if (!cached) mapsCache.set(lang, data, 60 * 1000); //ソースからの更新頻度
	const maps: string[] = []; //マップ名の配列
	const map = maps[Math.floor(Math.random() * maps.length)];
	return map;
};

const getLanguage = (locale: Locale) => {
	switch (locale) {
		// case Locale:
		// 	return "ar-AE";
		case Locale.German:
			return "de-DE";
		case Locale.EnglishUS:
			return "en-US";
		case Locale.SpanishES:
			return "es-ES";
		case Locale.SpanishES:
			return "es-MX";
		case Locale.French:
			return "fr-FR";
		case Locale.Indonesian:
			return "id-ID";
		case Locale.Italian:
			return "it-IT";
		case Locale.Japanese:
			return "ja-JP";
		case Locale.Korean:
			return "ko-KR";
		case Locale.Polish:
			return "pl-PL";
		case Locale.PortugueseBR:
			return "pt-BR";
		case Locale.Russian:
			return "ru-RU";
		case Locale.Thai:
			return "th-TH";
		case Locale.Turkish:
			return "tr-TR";
		case Locale.Vietnamese:
			return "vi-VN";
		case Locale.ChineseCN:
			return "zh-CN";
		case Locale.ChineseTW:
			return "zh-TW";
		default:
			return "ja-JP";
	}
};
