import { Locale } from "discord.js";
import Keyv from "keyv";
import { KeyvFile } from "keyv-file";

const cache = new Keyv({
	store: new KeyvFile({
		filename: "./.keyv",
	}),
	namespace: "cache",
});

export const TEAMS = 2;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getMap = async (locale: Locale): Promise<string | undefined> => {
	const key = "maps";
	const cached = await cache.has(key);
	const data = cached ? await cache.get(key) : {};
	if (cached) cache.set(key, data);
	const maps: string[] = [];
	const map = maps[Math.floor(Math.random() * maps.length)];
	return map;
};
