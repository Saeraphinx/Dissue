import { Octokit } from "octokit";
import { ActionRowBuilder, Client, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import * as fs from "fs";

if (!fs.existsSync("./config.json")) {
    console.log("Config file not found!");
    let config = {
        "DISCORD-BOT-TOKEN": "YOUR_DISCORD_BOT_TOKEN",
        "DISCORD-ALLOWED-USER": "YOUR_DISCORD_USER_ID",
        "GITHUB-PAT": "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN",
        "GITHUB-OWNER": "YOUR_GITHUB_USERNAME_OR_ORG",
        "GITHUB-REPO": "YOUR_GITHUB_REPO",
    };
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
    process.exit(1);
}

const Config = JSON.parse(fs.readFileSync("./config.json", "utf-8")) as {
    "DISCORD-BOT-TOKEN": string;
    "DISCORD-ALLOWED-USER": string;
    "GITHUB-PAT": string;
    "GITHUB-OWNER": string;
    "GITHUB-REPO": string;
};

const client = new Client({
    intents: [],
});

client.on("ready", async () => {
    console.log("Ready!");

    await client.application?.commands.create({
        name: `createissue`,
        description: `Create an issue in the ${Config["GITHUB-REPO"]} repository`,
    });
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand() && !interaction.isModalSubmit()) return;
    if (interaction.user.id !== Config["DISCORD-ALLOWED-USER"]) return;

    if (interaction.isCommand()) {
        if (interaction.commandName === "createissue") {
            let modal = new ModalBuilder()
            modal.setCustomId("createissuemodal");
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
            const issueTitle = interaction.fields.getTextInputValue("issuetitle");
            const issueDescription = interaction.fields.getTextInputValue("issuedescription");

            const octokit = new Octokit({
                auth: Config["GITHUB-PAT"],
            });

            await octokit.rest.issues.create({
                owner: Config["GITHUB-OWNER"],
                repo: Config["GITHUB-REPO"],
                title: issueTitle,
                body: issueDescription,
            });

            await interaction.reply({ content: "Issue created!", ephemeral: true });
        }
    }
});

client.login(Config["DISCORD-BOT-TOKEN"]).then(() => {
    console.log(`Logged in as ${client.user?.username}!`);
});