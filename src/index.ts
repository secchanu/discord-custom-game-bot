import dotenv from "dotenv";
dotenv.config();

import {
	ActionRowBuilder,
	APIEmbed,
	BaseInteraction,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Client,
	ComponentType,
	GatewayIntentBits,
} from "discord.js";
import { KeyvFile } from "keyv-file";

import { ACTIVITIES, getMap, TEAMS } from "./game";
import { getLang } from "./locale";
import { getCommands } from "./command";

const guilds = new KeyvFile({
	filename: "guilds.keyv",
});

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
	presence: {
		activities: ACTIVITIES,
	},
});

client.once("ready", () => {
	const guild_commands = getCommands()["global"];
	client.application?.commands?.set([...guild_commands]);
	const guildIds = client.guilds.cache.map((guild) => {
		const guildId = guild.id;
		if (guilds.has(guildId)) return guildId;
		const locale = guild.preferredLocale;
		const guild_commands = getCommands(locale)["guild"];
		client.application?.commands?.set(guild_commands["init"], guildId);
		return guildId;
	});
	guilds.keys().forEach((id) => {
		if (!guildIds.includes(id)) guilds.delete(id);
	});
});

client.on("guildCreate", (guild) => {
	const guildId = guild.id;
	const locale = guild.preferredLocale;
	const guild_commands = getCommands(locale)["guild"];
	client.application?.commands?.set(guild_commands["init"], guildId);
});

client.on("guildDelete", (guild) => {
	const guildId = guild.id;
	guilds.delete(guildId);
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const locale = interaction.locale ?? interaction.guildLocale;
	const lang = getLang(locale);

	// global command
	switch (interaction.commandName) {
		case "help": {
			await interaction.deferReply({ ephemeral: false });
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
									.setCustomId("reroll")
									.setStyle(ButtonStyle.Primary)
									.setLabel(lang["reroll"]),
							]),
					  ]
					: [];
				int?.isButton()
					? await int.update({ content, components })
					: await interaction.editReply({ content, components });
				if (!map) return;
				const filter = (i: BaseInteraction) =>
					i.isButton() &&
					["cancel", "confirm", "reroll"].includes(i.customId) &&
					i.user.id === interaction.user.id;
				const res = await botMessage
					.awaitMessageComponent<ComponentType.Button>({ filter })
					.catch(async () => {
						components[0]?.components?.forEach((c) => c?.setDisabled());
						await botMessage.edit({ content, components }).catch(() => {
							return;
						});
					});
				if (!res) return;
				switch (res.customId) {
					case "cancel": {
						await botMessage.delete().catch(() => {
							return;
						});
						break;
					}
					case "confirm": {
						await res.update({ content, components: [] });
						break;
					}
					case "reroll": {
						await mapFunc(res);
						break;
					}
				}
			};
			await mapFunc();
			break;
		}
	}

	// inGuild command
	if (!interaction.inCachedGuild()) return;
	const key = interaction.guildId;
	switch (interaction.commandName) {
		case "setting": {
			await interaction.deferReply({ ephemeral: false });
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
			guilds.set(key, channels);
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
			if (!guilds.has(key)) return;
			await interaction.deferReply({ ephemeral: false });
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
							.setCustomId("confirm")
							.setStyle(ButtonStyle.Success)
							.setLabel(lang["confirm"]),
						new ButtonBuilder()
							.setCustomId("reroll")
							.setStyle(ButtonStyle.Primary)
							.setLabel(lang["reroll"]),
					]),
				];
				int?.isButton()
					? await int.update({ content, components })
					: await interaction.editReply({ content, components });
				const filter = (i: BaseInteraction) =>
					i.isButton() &&
					["cancel", "confirm", "reroll"].includes(i.customId) &&
					i.user.id === interaction.user.id;
				const res = await botMessage
					.awaitMessageComponent<ComponentType.Button>({ filter })
					.catch(async () => {
						components[0]?.components?.forEach((c) => c?.setDisabled());
						await botMessage.edit({ content, components }).catch(() => {
							return;
						});
					});
				if (!res) return;
				switch (res.customId) {
					case "cancel": {
						await botMessage.delete().catch(() => {
							return;
						});
						break;
					}
					case "confirm": {
						const components = [
							new ActionRowBuilder<ButtonBuilder>().addComponents([
								new ButtonBuilder()
									.setCustomId("move")
									.setStyle(ButtonStyle.Primary)
									.setLabel(lang["move"]),
							]),
						];
						const filter = (i: BaseInteraction) =>
							i.isButton() &&
							"move" === i.customId &&
							i.user.id === interaction.user.id;
						const collector = botMessage.createMessageComponentCollector({
							filter,
						});
						collector.on("collect", async (i) => {
							await i.update({ content, components });
							const channels = guilds.get(key);
							const VCs = channels.VCs;
							teams.forEach((members, i) => {
								members.forEach((member) => {
									if (!member.voice.channel) return;
									member.voice.setChannel(VCs[i]).catch(() => {
										return;
									});
								});
							});
						});
						await res.update({ content, components });
						break;
					}
					case "reroll": {
						await teamFunc(res);
						break;
					}
				}
			};
			await teamFunc();
			break;
		}

		case "call": {
			if (!guilds.has(key)) return;
			await interaction.deferReply({ ephemeral: false });
			const cache = interaction.guild.channels.cache;
			const channels = guilds.get(key);
			const home = channels.home;
			const VCs = channels.VCs;
			await interaction.followUp(lang["calling"]);
			for (const vcId of VCs) {
				const vc = cache.get(vcId);
				if (vc?.type !== ChannelType.GuildVoice) continue;
				for (const member of vc?.members?.values()) {
					const voice = member.voice;
					if (!voice.channel || voice.channelId === home) continue;
					await member.voice.setChannel(home).catch(() => {
						return;
					});
				}
			}
			await interaction.editReply(lang["called"]);
			break;
		}
	}
});

client.login(process.env.BOT_TOKEN);
