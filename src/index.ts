import { Octokit } from "octokit";
import { ActionRowBuilder, ApplicationCommandOptionType, ApplicationIntegrationType, Client, Events, InteractionContextType, ModalBuilder, Routes, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import * as fs from "fs";

// #region Config
if (!fs.existsSync("./config.json")) {
    console.log("Config file not found!");
    let config = {
        "DISCORD-BOT-TOKEN": "YOUR_DISCORD_BOT_TOKEN",
        "DISCORD-ALLOWED-USER": "YOUR_DISCORD_USER_ID",
        "GITHUB-PAT": "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN",
        "GITHUB-REPO": ["YOUR_GITHUB_REPO"], // This can be an array of repositories if you want to create issues in multiple repositories
    };
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
    process.exit(1);
}

const Config = JSON.parse(fs.readFileSync("./config.json", "utf-8")) as {
    "DISCORD-BOT-TOKEN": string;
    "DISCORD-ALLOWED-USER": string;
    "GITHUB-PAT": string;
    "GITHUB-REPO": string[];
};
// #endregion

const client = new Client({
    intents: [],
});

client.on(Events.ClientReady, async (uc) => {
    console.log("Ready!");

    let command = new SlashCommandBuilder()
    command.setName("createissue");
    command.setIntegrationTypes(ApplicationIntegrationType.UserInstall);
    command.setDescription(`Create an issue in a GitHub repository`);
    command.addStringOption((option) => {
        option.setName("repository");
        option.setDescription("The repository to create the issue in.");
        option.setRequired(true);
        option.addChoices(...Config["GITHUB-REPO"].map((repo) => ({ name: repo, value: repo })));
        return option;
    });
    command.addStringOption((option) => {
        option.setName("shouldnotify");
        option.setDescription("Should the bot send a public message to the channel when the issue is created?");
        option.addChoices(
            { name: "Publicly notify the channel", value: "true" },
            { name: "Do not notify the channel", value: "false" }
        );
        option.setRequired(false);
        return option;
    });
    command.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel);

    if (uc.application.id) {
        console.log(`Registering commands to ${uc.application.id}...`);
        await uc.rest.put(Routes.applicationCommands(uc.application?.id), {
            body: [command.toJSON()],
        });
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand() && !interaction.isModalSubmit()) return;
    if (interaction.user.id !== Config["DISCORD-ALLOWED-USER"]) return;

    if (interaction.isCommand()) {
        if (interaction.commandName === "createissue") {
            let modal = new ModalBuilder()
            let repo = interaction.options.get("repository", true).value as string;
            let shouldNotify = interaction.options.get("shouldnotify")?.value as string;
            let data = {
                repo,
                shouldNotify: shouldNotify ? shouldNotify : "false"
            }
            modal.setCustomId(JSON.stringify(data,null,0));
            modal.setTitle("Create Issue");

            let issueTitle = new TextInputBuilder()
            issueTitle.setCustomId("issuetitle");
            issueTitle.setLabel("Issue Title");
            issueTitle.setStyle(TextInputStyle.Short);
            
            let issueDescription = new TextInputBuilder()
            issueDescription.setCustomId("issuedescription");
            issueDescription.setLabel("Issue Description");
            issueDescription.setStyle(TextInputStyle.Paragraph);

            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(issueTitle));
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(issueDescription));

            await interaction.showModal(modal);
        }
    } else {
        if (interaction.customId === "createissuemodal") {
            let data = JSON.parse(interaction.customId) as { repo: string, shouldNotify: string };
            const issueTitle = interaction.fields.getTextInputValue("issuetitle");
            const issueDescription = interaction.fields.getTextInputValue("issuedescription");

            const octokit = new Octokit({
                auth: Config["GITHUB-PAT"],
            });

            // check if an issue already exists with the same title before creating a new one
            const existingIssues = await octokit.rest.issues.listForRepo({
                owner: data.repo.split("/")[0],
                repo: data.repo.split("/")[1],
                state: "open",
            });
            if (existingIssues.data.some(issue => issue.title === issueTitle)) {
                return await interaction.reply({ content: `An issue with the same title already exists in [${data.repo}](<https://github.com/${data.repo}>).`, ephemeral: true });
            }

            let issue = await octokit.rest.issues.create({
                owner: data.repo.split("/")[0],
                repo: data.repo.split("/")[1],
                title: issueTitle,
                body: issueDescription,
            });

            if (issue.status !== 201) {
                return await interaction.reply({ content: `Failed to create issue\n\nStatus: ${issue.status}`});
            }
            await interaction.reply({ content: `Issue #[${issue.data.number}](${issue.data.html_url}) created in [${data.repo}](<https://github.com/${data.repo}>).`, ephemeral: data.shouldNotify === "false" ? true : false});
        }
    }
});

client.login(Config["DISCORD-BOT-TOKEN"]).then(() => {
    console.log(`Logged in as ${client.user?.username}!`);
});