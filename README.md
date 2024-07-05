# Main Instance
You can add the main instance to your user or server via the [Invite URL](https://discord.com/oauth2/authorize?client_id=1237532995158806608)
# Setting up for yourself
If you feel like making your own instance, here is a small guide on setting it up. <br>
# Prerequisites
- Create a [Cloudflare](https://www.cloudflare.com/) account if you do not already have one
- Install [GIT](https://github.com/git-guides/install-git) if you do not already have it installed.
- Install [Node](https://nodejs.org/en/download) if you do not already have it installed.
# Creating the bot
- Navigate to https://discord.com/developers/applications
- Create a new application
- Save the `PUBLIC KEY` and `APPLICATION ID` somewhere safe, you will need it later.
- Go to the "Installation" menu and enable both "Guild Install" and "User Install" if you'd like for it to be invitable.
- Go to the "Bot" menu and save the `TOKEN` somewhere safe, as you will need it later.

# Downloading the bot
- Run the command `git clone https://github.com/User9684/user-utils.git` in any directory, and then run `cd user-utils`.
- Run the command `npm i`
- Clone the `wrangler.example.toml` file and name it `wrangler.toml`.

# Configuring wrangler
- First, you must create three things via CLI. If you installed everything properly, you should have no trouble with this.
- Run the command `wrangler login` and follow the steps displayed.
- After that, run the command `wrangler kv namespace create RDAPCache` and save the `id` value provided to you.
- Replace the `id` under "RDAPCache" in your wrangler.toml with this newly obtained ID.
- Repeat the previous steps for `MessageQueries` instead of `RDAPCache`

# Deploying
- Finally, run the command `wrangler deploy` and if you did everything correctly, the bot should now be functional! :)