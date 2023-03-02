import { Locale } from "discord.js";
import { existsSync, readFileSync } from "fs";

export const getLang = (locale?: Locale) => {
	const path = `./locales/${
		existsSync(`./locales/${locale}.json`) ? locale : Locale.Japanese
	}.json`;
	const file = readFileSync(path, "utf-8");
	const data = JSON.parse(file);
	return data;
};
