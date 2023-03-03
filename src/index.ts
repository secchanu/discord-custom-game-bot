import dotenv from "dotenv";
dotenv.config();

import {
	ActionRowBuilder,
	ActivityType,
	APIEmbed,
	BaseInteraction,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Client,
	GatewayIntentBits,
} from "discord.js";
import Keyv from "keyv";
import { KeyvFile } from "keyv-file";

import { getMap, TEAMS } from "./game";
import { getLang } from "./locale";
import { getCommands } from "./command";

const guilds = new Keyv({
	store: new KeyvFile({
		filename: "./.keyv",
	}),
	namespace: "guilds",
});

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
	presence: {
		activities: [{ name: "VALORANT", type: ActivityType.Competing }],
	},
});

client.once("ready", () => {
	const guild_commands = getCommands()["global"];
	client.application?.commands?.set([...guild_commands]);
	client.guilds.cache.each(async (guild) => {
		const guildId = guild.id;
		if (await guilds.has(guildId)) return;
		const locale = guild.preferredLocale;
		const guild_commands = getCommands(locale)["guild"];
		client.application?.commands?.set([...guild_commands["init"]], guildId);
	});
});

client.on("guildCreate", (guild) => {
	const locale = guild.preferredLocale;
	const guild_commands = getCommands(locale)["guild"];
	client.application?.commands?.set([...guild_commands["init"]], guild.id);
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const locale = interaction.locale ?? interaction.guildLocale;
	const lang = getLang(locale);

	switch (interaction.commandName) {
		case "help": {
			await interaction.deferReply({ ephemeral: true });
			const embed: APIEmbed = {
				...lang["help_text"],
				fields: [
					{ name: "/help", value: lang["command"]["help"] },
					{ name: "/map", value: lang["command"]["map"] },
					{
						name: "/setting",
						value: lang["command"]["setting"],
					},
					{ name: "/team", value: lang["command"]["team"] },
					{
						name: "/call",
						value: lang["command"]["call"],
					},
				],
				footer: { text: "made by secchanu" },
			};
			await interaction.followUp({ embeds: [embed] });
			break;
		}

		case "map": {
			await interaction.deferReply({ ephemeral: false });
			const botMessage = await interaction.followUp(`${lang["loading"]}…`);
			const mapFunc = async (int?: BaseInteraction) => {
				const map = await getMap(locale);
				const content = map ?? lang["map_error"];
				const components = map
					? [
							new ActionRowBuilder<ButtonBuilder>().addComponents([
								new ButtonBuilder()
									.setCustomId("cancel")
									.setStyle(ButtonStyle.Danger)
									.setLabel(lang["cancel"]),
								new ButtonBuilder()
									.setCustomId("confirm")
									.setStyle(ButtonStyle.Success)
									.setLabel(lang["confirm"]),
								new ButtonBuilder()
									.setCustomId("again")
									.setStyle(ButtonStyle.Primary)
									.setLabel(lang["reroll"]),
							]),
					  ]
					: [];
				int?.isButton()
					? await int.update({ content, components })
					: await interaction.editReply({ content, components });
				const filter = (i: BaseInteraction) =>
					i.isButton() &&
					["cancel", "confirm", "again"].includes(i.customId) &&
					i.user.id === interaction.user.id;
				const res = await botMessage
					.awaitMessageComponent({ filter })
					.catch(() => {
						components[0].components.forEach((c) => c.setDisabled());
						botMessage.edit({ content, components });
					});
				if (!res) return;
				switch (res.customId) {
					case "cancel": {
						await botMessage.delete();
						break;
					}
					case "confirm": {
						await res.update({ content, components: [] });
						break;
					}
					case "again": {
						await mapFunc(res);
						break;
					}
				}
			};
			await mapFunc();
			break;
		}
	}

	if (!interaction.inCachedGuild()) return;
	const key = interaction.guildId;
	switch (interaction.commandName) {
		case "setting": {
			await interaction.deferReply({ ephemeral: true });
			if (!interaction.guild.members.me?.roles?.botRole) {
				await interaction.followUp(lang["botRole_error"]);
				return;
			}
			const options = interaction.options;
			const VCs = Array(TEAMS)
				.fill(null)
				.map((_, i) => {
					const index = i + 1;
					const channel = options.getChannel(`vc${index}`);
					return channel;
				});
			const channelHome = options.getChannel("home");
			const notVCs = [...VCs, channelHome]
				.filter((ch) => ch)
				.filter((ch) => ch?.type !== ChannelType.GuildVoice);
			if (notVCs.length) {
				await interaction.followUp(
					`${notVCs.join(", ")} ${lang["setting_error"]}`,
				);
				return;
			}
			const home = channelHome ?? VCs.at(0);
			const channels = {
				home: home?.id,
				VCs: VCs.map((ch) => ch?.id),
			};
			await guilds.set(key, channels);
			const guild_commands = getCommands(locale)["guild"];
			await client.application?.commands?.set(
				[...guild_commands["init"], ...guild_commands["setup"]],
				interaction.guildId,
			);
			await interaction.followUp(
				`${lang["setting_text"]}\n\n${VCs.reduce((acc, vc, i) => {
					const index = i + 1;
					return acc + `VC${index} : ${vc}\n`;
				}, "")}\nHome : ${home}`,
			);
			break;
		}

		case "team": {
			if (!(await guilds.has(key))) return;
			await interaction.deferReply({ ephemeral: false });
			if (!interaction.inCachedGuild()) return;
			const channel = interaction.member.voice.channel;
			if (!channel) {
				await interaction.followUp(lang["team_error"]);
				return;
			}
			const botMessage = await interaction.followUp(`${lang["loading"]}…`);
			const members = channel.members.filter((m) => !m.user.bot);
			const division = TEAMS;
			const teamSize = Math.ceil(members.size / division);
			const teamFunc = async (int?: BaseInteraction) => {
				const players = members.clone();
				let under = division * teamSize - players.size;
				const teams = new Array(division).fill(null).map((_, i) => {
					const handicap = Math.ceil(under / (division - i));
					under -= handicap;
					const num = teamSize - handicap;
					const rands = players.random(num);
					players.sweep((p) => rands.includes(p));
					return rands;
				});
				const content = teams.reduce((acc, members, i) => {
					const index = i + 1;
					return (
						acc +
						`${lang["team"]}${index}\n` +
						members.map((m) => m.toString()).join("\n") +
						"\n\n"
					);
				}, "");
				const components = [
					new ActionRowBuilder<ButtonBuilder>().addComponents([
						new ButtonBuilder()
							.setCustomId("cancel")
							.setStyle(ButtonStyle.Danger)
							.setLabel(lang["cancel"]),
						new ButtonBuilder()
							.setCustomId("move")
							.setStyle(ButtonStyle.Success)
							.setLabel(lang["move"]),
						new ButtonBuilder()
							.setCustomId("again")
							.setStyle(ButtonStyle.Primary)
							.setLabel(lang["reroll"]),
					]),
				];
				int?.isButton()
					? await int.update({ content, components })
					: await interaction.editReply({ content, components });
				const filter = (i: BaseInteraction) =>
					i.isButton() &&
					["cancel", "move", "again"].includes(i.customId) &&
					i.user.id === interaction.user.id;
				const res = await botMessage
					.awaitMessageComponent({ filter })
					.catch(() => {
						components[0].components.forEach((c) => c.setDisabled());
						botMessage.edit({ content, components });
					});
				if (!res) return;
				switch (res.customId) {
					case "cancel": {
						await botMessage.delete();
						break;
					}
					case "move": {
						await res.update({ content, components: [] });
						const channels = await guilds.get(key);
						const VCs = channels.VCs;
						teams.forEach((members, i) => {
							members.forEach((member) => {
								if (!member.voice.channel) return;
								member.voice.setChannel(VCs[i]);
							});
						});
						break;
					}
					case "again": {
						await teamFunc(res);
						break;
					}
				}
			};
			await teamFunc();
			break;
		}

		case "call": {
			if (!(await guilds.has(key))) return;
			await interaction.deferReply({ ephemeral: false });
			const cache = interaction.guild.channels.cache;
			const channels = await guilds.get(key);
			const home = channels.home;
			const VCs = channels.VCs;
			await interaction.followUp(lang["calling"]);
			for (const vcId of VCs) {
				const vc = cache.get(vcId);
				if (vc?.type !== ChannelType.GuildVoice) continue;
				for (const member of vc?.members?.values()) {
					const voice = member.voice;
					if (!voice.channel || voice.channelId === home) continue;
					await member.voice.setChannel(home);
				}
			}
			await interaction.editReply(lang["called"]);
			break;
		}
	}
});

client.login(process.env.BOT_TOKEN);
