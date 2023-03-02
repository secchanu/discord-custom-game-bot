import { ApplicationCommandOptionType, Locale } from "discord.js";

import { TEAMS } from "./game";
import { getLang } from "./locale";

export const getCommands = (locale?: Locale) => {
	const lang = getLang(locale);
	return {
		global: [
			{
				name: "help",
				description: "BOTの説明を表示します - Show BOT description",
			},
			{
				name: "map",
				description: lang["command"]["map"],
			},
		],
		guild: {
			init: [
				{
					name: "setting",
					description: lang["command"]["setting"],
					options: [
						...Array(TEAMS)
							.fill({
								type: ApplicationCommandOptionType.Channel,
								required: true,
							})
							.map((t, i) => {
								const index = i + 1;
								return { ...t, name: `vc${index}`, description: `VC${index}` };
							}),
						{
							type: ApplicationCommandOptionType.Channel,
							name: "home",
							description: "Home",
							required: false,
						},
					],
				},
			],
			setup: [
				{
					name: "team",
					description: lang["command"]["team"],
				},
				{
					name: "call",
					description: lang["command"]["call"],
				},
			],
		},
	};
};
