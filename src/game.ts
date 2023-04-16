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
	if (!cached) mapsCache.set(lang, data, 60 * 60 * 1000); //ソースからの更新頻度
	const maps: string[] = []; //マップ名の配列
	const map = maps[Math.floor(Math.random() * maps.length)];
	return map;
};
