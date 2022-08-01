#!/usr/bin/env node
"use strict";

const fs = require("fs");
const open = require("open");
const { Command, Option } = require("commander");
const pkg = require("../package.json");
const { SkynetClient } = require("@skynetlabs/skynet-nodejs");
const {
  deriveChildSeed,
  genKeyPairAndSeed,
  genKeyPairFromSeed,
  convertSkylinkToBase32,
  convertSkylinkToBase64,
  parseSkylink,
} = require("skynet-js");

let client;
let globalDebug;
let globalSkynetApiKey;
let globalAPIKey;
let globalCustomUserAgent;
let globalPortal;

// Common options can be added when subcommands are created by using a custom subclass.
// If the options are unsorted in the help, these will appear first.
class MyRootCommand extends Command {
  createCommand(name) {
    const cmd = new Command(name);
    return cmd;
  }
}

const program = new MyRootCommand();

program
  .name("skynet")
  .usage("[Options]  Command [GlobalOptions]")
  .summary("The skynet CLI form nodejs-skynet.")
  .description("Perform actions related to Skynet, a file sharing and data publication platform built on top of Sia.")
  .version("skynetCLI " + pkg.version)
  .showHelpAfterError()
  .addOption(new Option("-P, --customPortal <portal>").hideHelp())
  .on("option:customPortal", function (portal) {
    globalPortal = portal;
  })
  .addOption(new Option("-A, --customUserAgent <customUserAgent>").hideHelp())
  .on("option:customUserAgent", function (customUserAgent) {
    globalCustomUserAgent = customUserAgent;
  })
  .addOption(new Option("-K --skynetApiKey <skynetApiKey>").hideHelp())
  .on("option:skynetApiKey", function (skynetApiKey) {
    globalSkynetApiKey = skynetApiKey;
  })
  .addOption(new Option("-l, --APIKey <APIKey>").hideHelp())
  .on("option:APIKey", function (APIKey) {
    console.log("APIKey: " + APIKey);
    globalAPIKey = APIKey;
  })
  .addOption(new Option("-d, --debug").hideHelp())
  .on("option:debug", function () {
    console.log("debug: true");
    globalDebug = true;
  });

program.configureHelp({
  sortSubcommands: true,
  sortOptions: true,
  subcommandTerm: (cmd) => cmd.name(),
});

program.addHelpText(
  "beforeAll",
  `
                                                                               ///((((((/.                         
                                                                      ((((((((((((((((((((((((((((                 
                                                                  (((((((((((((((((((((((((((((((((((/.            
                                                              .(((((((((((((((/(/(/(/////((((((((((((((((/         
                                                            ((((((((((((/(                      (((((((((((/       
                                                          ((((((((((/(                              (((((((((/     
                                                        /(((((((((/                                   /((((((((/   
                                        .(             (((((((((/                                       .(((((((/  
                                            /((         /(((((/(                                          (((((((( 
                                                (((*        ./                                             (((((((( 
                                                   (((//         *                                          ((((((((
                                                       ((((((         ((          /(                         ((((((/
                                                   /       (((((//         (//           /(/(.               (((((((
                                                   ((((       //((((((,        (((((,          //((((((      (((((((
                                                    (((((((       /((((((((         (((((/(          //((((((((((((/
                                                    (((((((((        /(((((((((/         (((((((/           (/(((((
                                                    ((((((((((           /(((((((((((        ((((((((/(,           
                                                     ((((((((((              ((((((((((((         //(((((((((/     
                                                      (((((((((/                ((((((((((((/(         ((((((((((/ 
                                                       //((((((((/                  (((((((((((((((        (((((// 
                                                         ((((((((((((                  .((((((((((((((/(           
                                                           ((((((((((((/                   /(((((((((((((((((       
                                                             ((((((((((((((((               /(((((((((((((((       
                                                               //(((((((((((((((((((((((((((((((((((((((//         
                                                                   ((((((((((((((((((((((((((((((((((/(            
                                                                       .//(((((((((((((((((((((/((                 
                                                                                //((((((/,                         
                                                                                          
                                                                                                                                       
                  kkkkkkkk                                                                                   tttt                  CCCCCCCCCCCCCLLLLLLLLLLL             IIIIIIIIII
                  k::::::k                                                                                ttt:::t               CCC::::::::::::CL:::::::::L             I::::::::I
                  k::::::k                                                                                t:::::t             CC:::::::::::::::CL:::::::::L             I::::::::I
                  k::::::k                                                                                t:::::t            C:::::CCCCCCCC::::CLL:::::::LL             II::::::II
     ssssssssss    k:::::k    kkkkkkkyyyyyyy           yyyyyyynnnn  nnnnnnnn        eeeeeeeeeeee    ttttttt:::::ttttttt     C:::::C       CCCCCC  L:::::L                 I::::I  
   ss::::::::::s   k:::::k   k:::::k  y:::::y         y:::::y n:::nn::::::::nn    ee::::::::::::ee  t:::::::::::::::::t    C:::::C                L:::::L                 I::::I  
 ss:::::::::::::s  k:::::k  k:::::k    y:::::y       y:::::y  n::::::::::::::nn  e::::::eeeee:::::eet:::::::::::::::::t    C:::::C                L:::::L                 I::::I  
 s::::::ssss:::::s k:::::k k:::::k      y:::::y     y:::::y   nn:::::::::::::::ne::::::e     e:::::etttttt:::::::tttttt    C:::::C                L:::::L                 I::::I  
  s:::::s  ssssss  k::::::k:::::k        y:::::y   y:::::y      n:::::nnnn:::::ne:::::::eeeee::::::e      t:::::t          C:::::C                L:::::L                 I::::I  
    s::::::s       k:::::::::::k          y:::::y y:::::y       n::::n    n::::ne:::::::::::::::::e       t:::::t          C:::::C                L:::::L                 I::::I  
       s::::::s    k:::::::::::k           y:::::y:::::y        n::::n    n::::ne::::::eeeeeeeeeee        t:::::t          C:::::C                L:::::L                 I::::I  
 ssssss   s:::::s  k::::::k:::::k           y:::::::::y         n::::n    n::::ne:::::::e                 t:::::t    tttttt C:::::C       CCCCCC  L:::::L         LLLLLL  I::::I  
 s:::::ssss::::::sk::::::k k:::::k           y:::::::y          n::::n    n::::ne::::::::e                t::::::tttt:::::t  C:::::CCCCCCCC::::CLL:::::::LLLLLLLLL:::::LII::::::II
 s::::::::::::::s k::::::k  k:::::k           y:::::y           n::::n    n::::n e::::::::eeeeeeee        tt::::::::::::::t   CC:::::::::::::::CL::::::::::::::::::::::LI::::::::I
  s:::::::::::ss  k::::::k   k:::::k         y:::::y            n::::n    n::::n  ee:::::::::::::e          tt:::::::::::tt     CCC::::::::::::CL::::::::::::::::::::::LI::::::::I
   sssssssssss    kkkkkkkk    kkkkkkk       y:::::y             nnnnnn    nnnnnn    eeeeeeeeeeeeee            ttttttttttt          CCCCCCCCCCCCCLLLLLLLLLLLLLLLLLLLLLLLLIIIIIIIIII
                                           y:::::y                                                                                                                                
                                          y:::::y                                                                                                                                
                                         y:::::y                                                                                                                               
                                        y:::::y                                                                                                                               
                                       yyyyyyy                                                                                                                                       
                                                                 
									   
`
);

program.addHelpText(
  "afterAll",
  `

GlobalOptions:
  -P, --customPortal <portal>               Set a Custom Skynet Portal.
  -A, --customUserAgent <customUserAgent>   Allows changing the User Agent, as some portals may reject user agents that are not Sia-Agent for security reasons.
  -K, --skynetApiKey <skynetApiKey>         The Skynet Portal Authentication-Key.
  -l, --APIKey <APIKey>                     The Local Node Authentication-Key.
  -d, --debug                               Debug console log output.
	

------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
## https://siasky.net ###### https://siasky.net ###### https://siasky.net ###### https://siasky.net ###### https://siasky.net ###### https://siasky.net ###### https://siasky.net ##
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
	`
);

function setGlobalOptions() {
  //###########
  // with APIKey
  //###########
  if (globalAPIKey) {
    // without skynetApiKey
    if (!globalSkynetApiKey) {
      // with customPortal and APIKey
      if (globalPortal && globalCustomUserAgent && globalAPIKey) {
        client = new SkynetClient(globalPortal, { globalCustomUserAgent, globalAPIKey });
        if (globalDebug) {
          console.log("12.Aktive is: customPortal / customUserAgent / APIKey.\n");
        }
      }

      if (globalPortal && globalAPIKey) {
        client = new SkynetClient(globalPortal, { globalAPIKey });
        if (globalDebug) {
          console.log("11.Aktive is: customPortal / APIKey.\n");
        }
      }

      // with defaultPortal and APIKey
      if (!globalPortal && globalCustomUserAgent && globalAPIKey) {
        client = new SkynetClient("", { globalCustomUserAgent, globalAPIKey });
        if (globalDebug) {
          console.log("10.Aktive is: defaultPortal / customUserAgent / APIKey.\n");
        }
      }

      if (!globalPortal && globalAPIKey) {
        client = new SkynetClient("", { globalAPIKey });
        if (globalDebug) {
          console.log("9.Aktive is: defaultPortal / APIKey.\n");
        }
      }
    }
  }

  //###########
  // without APIKey
  //###########
  if (!globalAPIKey) {
    // with skynetApiKey
    if (globalSkynetApiKey) {
      // with customPortal and skynetApiKey
      if (globalPortal && globalCustomUserAgent && globalSkynetApiKey) {
        client = new SkynetClient(globalPortal, { globalCustomUserAgent, skynetApiKey: globalSkynetApiKey });
        if (globalDebug) {
          console.log("8.Aktive is: customPortal / customUserAgent / skynetApiKey.\n");
        }
      }

      if (globalPortal && globalSkynetApiKey) {
        client = new SkynetClient(globalPortal, { skynetApiKey: globalSkynetApiKey });
        if (globalDebug) {
          console.log("7.Aktive is: customPortal / skynetApiKey.\n");
        }
      }

      // with defaultPortal and skynetApiKey
      if (!globalPortal && globalCustomUserAgent && globalSkynetApiKey) {
        client = new SkynetClient("", { globalCustomUserAgent, skynetApiKey: globalSkynetApiKey });
        if (globalDebug) {
          console.log("6.Aktive is: defaultPortal / customUserAgent / skynetApiKey.\n");
        }
      }

      if (!globalPortal && globalSkynetApiKey) {
        client = new SkynetClient("", { skynetApiKey: globalSkynetApiKey });
        if (globalDebug) {
          console.log("5.Aktive is: defaultPortal / skynetApiKey.\n");
        }
      }
    }

    // without skynetApiKey and APIKey
    if (!globalSkynetApiKey) {
      // with customPortal
      if (globalPortal && globalCustomUserAgent) {
        client = new SkynetClient(globalPortal, { globalCustomUserAgent });
        if (globalDebug) {
          console.log("4.Aktive is: customPortal / customUserAgent.\n");
        }
      }

      if (globalPortal) {
        client = new SkynetClient(globalPortal);
        if (globalDebug) {
          console.log("3.Aktive is: customPortal.\n");
        }
      }

      // with defaultPortal
      if (!globalPortal && globalCustomUserAgent) {
        client = new SkynetClient("", { globalCustomUserAgent });
        if (globalDebug) {
          console.log("2.Aktive is: defaultPortal / customUserAgent.\n");
        }
      }

      //without all
      if (!globalPortal && !globalCustomUserAgent) {
        client = new SkynetClient();
        if (globalDebug) {
          console.log("1.Aktive is: defaultPortal.\n");
        }
      }
    }
  }
  return client;
}

// ######### download ###########
const download = program.command("download");

download.usage("[options] [command] [GlobalOptions]").description("All Commands Downloading from Skynet");

download
  .command("downloadData")
  .usage("[options] [command] <skylink> [GlobalOptions]")
  .description("Downloading a Data from Skynet")
  .argument("<skylink>", "The skylink that should be downloaded.")
  .action(async (skylink) => {
    setGlobalOptions();
    const data = await client.downloadData(skylink);
    console.log("Data: " + data);
    console.log("Downloading Data successful.");
  });

download
  .command("downloadFile")
  .usage("[options] [command] <localpath> <skylink> [GlobalOptions]")
  .description("Downloading a File/Directory from Skynet")
  .argument("<localpath>", "The local path where the file should be downloaded to.")
  .argument("<skylink>", "The skylink that should be downloaded.")
  .option("--path <path>", " The skylink can contain an optional path.")
  .action(async (localpath, skylink, options) => {
    setGlobalOptions();
    if (!options.path) {
      await client.downloadFile(localpath, skylink);
      console.log("Downloading File successful.");
    }
    if (options.path) {
      const skylinkpath = skylink + "/" + options.path;
      await client.downloadFile(localpath, skylinkpath);
      console.log("Downloading File form Directory successful.");
    }
  });

download
  .command("downloadFileHns")
  .usage("[options] <localpath> <domain> [GlobalOptions]")
  .description("Downloading Handshake Files from Skynet")
  .argument("<localpath>", "The local path where the file should be downloaded to.")
  .argument("<domain>", "The Handshake domain that should be downloaded.")
  .action(async (localpath, domain) => {
    setGlobalOptions();
    await client.downloadFileHns(localpath, domain);
    console.log("Downloading Handshake File successful.");
  });
download
  .command("getFileContent")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting a FileContent from Skylink")
  .argument("<skylink>", "The skylink that should be get as Url.")
  .option("--save <localPath>", "The local path where the FileContent should be saved to.")
  .action(async (skylink, options) => {
    setGlobalOptions();

    if (options.save) {
      const data = await client.getFileContent(skylink);
      if (data) {
        fs.writeFileSync(options.save, data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContent from Skylink saved successful.");
      }
    }

    if (!options.save) {
      const data = await client.getFileContent(skylink);
      if (data) {
        console.log("data: " + data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContent from Skylink successful.");
      }
    }
  });

download
  .command("getFileContentBinary")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting a FileContentBinary from Skylink")
  .argument("<skylink>", "The skylink that should be get as Url.")
  .option("--save <localPath>", "The local path where the FileContentBinary should be saved to.")
  .action(async (skylink, options) => {
    setGlobalOptions();

    if (options.save) {
      const data = await client.getFileContentBinary(skylink);
      if (data) {
        fs.writeFileSync(options.save, data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentBinary from Skylink saved successful.");
      }
    }

    if (!options.save) {
      const data = await client.getFileContentBinary(skylink);
      if (data) {
        console.log("data: " + data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentBinary from Skylink successful.");
      }
    }
  });

download
  .command("getFileContentBinaryHns")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting a FileContentBinaryHns from Handshake Domain")
  .argument("<domain>", "The Handshake domain that should be get as Url.")
  .option("--save <localPath>", "The local path where the FileContentBinaryHns should be saved to.")
  .action(async (domain, options) => {
    setGlobalOptions();

    if (options.save) {
      const data = await client.getFileContentBinaryHns(domain);
      if (data) {
        fs.writeFileSync(options.save, data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentBinaryHns from Handshake Domain saved successful.");
      }
    }

    if (!options.save) {
      const data = await client.getFileContentBinaryHns(domain);
      if (data) {
        console.log("data: " + data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentBinaryHns from Handshake Domain successful.");
      }
    }
  });

download
  .command("getFileContentHns")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting a FileContentHns from Handshake Domain")
  .argument("<domain>", "The Handshake domain that should be get as Url.")
  .option("--save <localPath>", "The local path where the FileContentHns should be saved to.")
  .action(async (domain, options) => {
    setGlobalOptions();

    if (options.save) {
      const data = await client.getFileContentHns(domain);
      if (data) {
        fs.writeFileSync(options.save, data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentHns from Handshake Domain saved successful.");
      }
    }

    if (!options.save) {
      const data = await client.getFileContentHns(domain);
      if (data) {
        console.log("data: " + data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentHns from Handshake Domain successful.");
      }
    }
  });

download
  .command("getHnsresUrl")
  .usage("[options] <domain> [GlobalOptions]")
  .description("Getting A Handshake Resolver URL")
  .argument("<domain>", "The Handshake domain that should be get as Url.")
  .action(async (domain) => {
    setGlobalOptions();
    const url = await client.getHnsresUrl(domain);
    if (url) {
      console.log("Url: " + url);
      console.log("Getting A Handshake Resolver URL successful.");
    }
  });

download
  .command("getHnsUrl")
  .usage("[options] <domain> [GlobalOptions]")
  .description("Getting a Url from Handshake Domain")
  .argument("<domain>", "The Handshake domain that should be get as Url.")
  .action(async (domain) => {
    setGlobalOptions();
    const url = await client.getHnsUrl(domain);
    if (url) {
      console.log("Url: " + url);
      console.log("Getting a Url from Handshake Domain successful.");
    }
  });

download
  .command("getMetadata")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting Metadata from a skylink")
  .argument(
    "<skylink>",
    "The skylink that should be downloaded. The skylink can contain an optional path. \nThis path can specify a directory or a particular file. If specified, only that file or directory will be returned."
  )
  .action(async (skylink) => {
    setGlobalOptions();
    const md = await client.getMetadata(skylink);
    if (md) {
      console.log("Metadata: " + JSON.stringify(md));
      console.log("Getting Metadata from a skylink successful.");
    }
  });

download
  .command("getSkylinkUrl")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting Url from Skylink")
  .argument("<skylink>", "The skylink that should be get as Url.")
  .action(async (skylink) => {
    setGlobalOptions();
    const url = await client.getSkylinkUrl(skylink);
    if (url) {
      console.log("Url: " + url);
      console.log("Getting Url from Skylink successful.");
    }
  });

download
  .command("openFile")
  .usage("[options] <skylink> [GlobalOptions]")
  .summary("Opening A File in Browser")
  .description(
    "Use the client to open a  in a new browser tab. \nBrowsers support opening natively only limited file extensions like .html or .jpg and will fallback to downloading the file."
  )
  .argument("<skylink>", "The skylink that should be open as Url.")
  .action(async (skylink) => {
    setGlobalOptions();
    await open(skylink);
    console.log("Opening A File in Browser successful.");
  });

download
  .command("openFileHns")
  .usage("[options] <domain> [GlobalOptions]")
  .summary("Opening A Handshake domain in Browser")
  .description("Use the client to open a Handshake domain in a new browser tab.")
  .argument("<domain>", "The Handshake domain that should be open as Url.")
  .action(async (domain) => {
    setGlobalOptions();
    const url = await client.getHnsUrl(domain);
    if (url) {
      console.log("Url: " + url);
      await open(url);
      console.log("Opening A Handshake domain in Browser successful.");
    }
  });

download
  .command("resolveHns")
  .usage("[options] <domain> [GlobalOptions]")
  .description("Resolving Handshake Domains from Skynet")
  .argument("<domain>", "The Handshake domain that should be resolved.")
  .action(async (domain) => {
    setGlobalOptions();
    const data = await client.resolveHns(domain);
    console.log("Response Data: " + JSON.stringify(data));
    console.log("Handshake resolve successful.");
  });

// ############ file #################
const file = program.command("file");

file.usage("[options] [command] [GlobalOptions]").description("All Commands with Handshake on Skynet");

file
  .command("getEntryData")
  .usage("[options] <userID> <path> [GlobalOptions]")
  .description("Getting a existing File API entry data from Skynet")
  .argument("<userID>", "The User Id from mysky. User Id is the publicKey-")
  .argument("<path>", "The data path.")
  .option("--save <localPath>", "The local path where the entry data should be saved to.")
  .option("-s, --seed", "A long secure seed instead of <userID>.")
  .action(async (userID, path, options) => {
    setGlobalOptions();
    if (options.seed) {
      if (options.save) {
        const { publicKey } = genKeyPairFromSeed(userID);
        const { data } = await client.file.getJSON(publicKey, path);
        fs.writeFileSync(options.save, JSON.stringify(data));
        console.log("Getting a existing File API entry data from Skynet with Seed saved successful.");
      }

      if (!options.save) {
        const { publicKey } = genKeyPairFromSeed(userID);
        const { data } = await client.file.getJSON(publicKey, path);
        console.log("Data: " + JSON.stringify(data));
        console.log("Getting a existing File API entry data from Skynet with Seed successful.");
      }
    }

    if (!options.seed) {
      if (options.save) {
        const { data } = await client.file.getJSON(userID, path);
        fs.writeFileSync(options.save, JSON.stringify(data));
        console.log("Getting a existing File API entry data from Skynet saved successful.");
      }

      if (!options.save) {
        const { data } = await client.file.getJSON(userID, path);
        console.log("Data: " + JSON.stringify(data));
        console.log("Getting a existing File API entry data from Skynet successful.");
      }
    }
  });

file
  .command("getEntryLink")
  .usage("[options] <userID> <path> [GlobalOptions]")
  .description("Getting a existing entry link for a user ID and path from Skynet")
  .argument("<userID>", "The User Id from mysky. User Id is the publicKey-")
  .argument("<path>", "The data path.")
  .option("-s, --seed", "A long secure seed instead of <userID>.")
  .action(async (userID, path, options) => {
    setGlobalOptions();
    if (options.seed) {
      const { publicKey } = genKeyPairFromSeed(userID);
      const entryLink = await client.file.getJSON(publicKey, path);
      console.log("EntryLink: " + entryLink);
      console.log("Getting a existing entry link for a user ID and path from Skynet with Seed successful.");
    }

    if (!options.seed) {
      const entryLink = await client.file.getJSON(userID, path);
      console.log("EntryLink: " + entryLink);
      console.log("Getting a existing entry link for a user ID and path from Skynet successful.");
    }
  });

file
  .command("getJSON")
  .usage("[options] <userID> <path> [GlobalOptions]")
  .description("Getting a existing File API JSON data from Skynet")
  .argument("<userID>", "The User Id from mysky. User Id is the publicKey-")
  .argument("<path>", "The data path.")
  .option("--save <localPath>", "The local path where the json should be saved to.")
  .option("-s, --seed", "A long secure seed instead of <userID>.")
  .action(async (userID, path, options) => {
    setGlobalOptions();
    if (options.seed) {
      if (options.save) {
        const { publicKey } = genKeyPairFromSeed(userID);
        const { data } = await client.file.getJSON(publicKey, path);
        fs.writeFileSync(options.save, JSON.stringify(data));
        console.log("Getting a existing File API JSON data from Skynet with Seed saved successful.");
      }

      if (!options.save) {
        const { publicKey } = genKeyPairFromSeed(userID);
        const { data } = await client.file.getJSON(publicKey, path);
        console.log("Data: " + JSON.stringify(data));
        console.log("Getting a existing File API JSON data from Skynet with Seed successful.");
      }
    }

    if (!options.seed) {
      if (options.save) {
        const { data } = await client.file.getJSON(userID, path);
        fs.writeFileSync(options.save, JSON.stringify(data));
        console.log("Getting a existing File API JSON data from Skynet saved successful.");
      }

      if (!options.save) {
        const { data } = await client.file.getJSON(userID, path);
        console.log("Data: " + JSON.stringify(data));
        console.log("Getting a existing File API JSON data from Skynet successful.");
      }
    }
  });

file
  .command("getJSONEncrypted")
  .usage("[options] <userID> <pathSeed> [GlobalOptions]")
  .description("Getting a existing encrypted JSON from Skynet")
  .argument("<userID>", "The User Id from mysky. User Id is the publicKey-")
  .argument("<pathSeed>", "The Seed form the data path.")
  .option("--save <localPath>", "The local path where the json should be saved to.")
  .option("-s, --seed", "A long secure seed instead of <userID>.")
  .action(async (userID, pathSeed, options) => {
    setGlobalOptions();

    if (options.seed) {
      if (options.save) {
        const { publicKey } = genKeyPairFromSeed(userID);
        const { data } = await client.file.getJSONEncrypted(publicKey, pathSeed);
        fs.writeFileSync(options.save, JSON.stringify(data));
        console.log("Getting a existing encrypted JSON from Skynet with Seed saved successful.");
      }

      if (!options.save) {
        const { publicKey } = genKeyPairFromSeed(userID);
        const { data } = await client.file.getJSONEncrypted(publicKey, pathSeed);
        console.log("Encrypted Data: " + JSON.stringify(data));
        console.log("Getting a existing encrypted JSON from Skynet with Seed successful.");
      }
    }

    if (!options.seed) {
      if (options.save) {
        const { data } = await client.file.getJSONEncrypted(userID, pathSeed);
        fs.writeFileSync(options.save, JSON.stringify(data));
        console.log("Getting a existing encrypted JSON from Skynet saved successful.");
      }

      if (!options.save) {
        const { data } = await client.file.getJSONEncrypted(userID, pathSeed);
        console.log("Encrypted Data: " + JSON.stringify(data));
        console.log("Getting a existing encrypted JSON from Skynet successful.");
      }
    }
  });

// ############ hns #################
const hns = program.command("hns");

hns.usage("[options] [command] [GlobalOptions]").description("All Commands with Handshake on Skynet");

hns
  .command("downloadFileHns")
  .usage("[options] <localpath> <domain> [GlobalOptions]")
  .description("Downloading Handshake Files from Skynet")
  .argument("<localpath>", "The local path where the file should be downloaded to.")
  .argument("<domain>", "The Handshake domain that should be downloaded.")
  .action(async (localpath, domain) => {
    setGlobalOptions();
    await client.downloadFileHns(localpath, domain);
    console.log("Downloading Handshake File successful.");
  });

hns
  .command("getFileContentBinaryHns")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting a FileContentBinaryHns from Handshake Domain")
  .argument("<domain>", "The Handshake domain that should be get as Url.")
  .option("--save <localPath>", "The local path where the FileContentBinaryHns should be saved to.")
  .action(async (domain, options) => {
    setGlobalOptions();

    if (options.save) {
      const data = await client.getFileContentBinaryHns(domain);
      if (data) {
        fs.writeFileSync(options.save, data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentBinaryHns from Handshake Domain saved successful.");
      }
    }

    if (!options.save) {
      const data = await client.getFileContentBinaryHns(domain);
      if (data) {
        console.log("data: " + data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentBinaryHns from Handshake Domain successful.");
      }
    }
  });

hns
  .command("getFileContentHns")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting a FileContentHns from Handshake Domain")
  .argument("<domain>", "The Handshake domain that should be get as Url.")
  .option("--save <localPath>", "The local path where the FileContentHns should be saved to.")
  .action(async (domain, options) => {
    setGlobalOptions();

    if (options.save) {
      const data = await client.getFileContentHns(domain);
      if (data) {
        fs.writeFileSync(options.save, data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentHns from Handshake Domain saved successful.");
      }
    }

    if (!options.save) {
      const data = await client.getFileContentHns(domain);
      if (data) {
        console.log("data: " + data.data);
        console.log("contentType: " + data.contentType);
        console.log("portalUrl: " + data.portalUrl);
        console.log("skylink: " + data.skylink);
        console.log("Getting a FileContentHns from Handshake Domain successful.");
      }
    }
  });

hns
  .command("getHnsresUrl")
  .usage("[options] <domain> [GlobalOptions]")
  .description("Getting A Handshake Resolver URL")
  .argument("<domain>", "The Handshake domain that should be get as Url.")
  .action(async (domain) => {
    setGlobalOptions();
    const url = await client.getHnsresUrl(domain);
    if (url) {
      console.log("Url: " + url);
      console.log("Getting A Handshake Resolver URL successful.");
    }
  });

hns
  .command("getHnsUrl")
  .usage("[options] <domain> [GlobalOptions]")
  .description("Getting A Handshake URL")
  .argument("<domain>", "The Handshake domain that should be get as Url.")
  .action(async (domain) => {
    setGlobalOptions();
    const url = await client.getHnsUrl(domain);
    if (url) {
      console.log("Url: " + url);
      console.log("Getting A Handshake URL successful.");
    }
  });

hns
  .command("openFileHns")
  .usage("[options] <domain> [GlobalOptions]")
  .summary("Opening A Handshake domain in Browser")
  .description("Use the client to open a Handshake domain in a new browser tab.")
  .argument("<domain>", "The Handshake domain that should be open as Url.")
  .action(async (domain) => {
    setGlobalOptions();
    const url = await client.getHnsUrl(domain);
    if (url) {
      console.log("Url: " + url);
      await open(url);
      console.log("Opening A Handshake domain in Browser successful.");
    }
  });

hns
  .command("resolveHns")
  .usage("[options] <domain> [GlobalOptions]")
  .description("Resolving Handshake Domains from Skynet")
  .argument("<domain>", "The Handshake domain that should be resolved.")
  .action(async (domain) => {
    setGlobalOptions();
    const data = await client.resolveHns(domain);
    console.log("Response Data: " + JSON.stringify(data));
    console.log("Handshake resolve successful.");
  });

// ############ links #################
const links = program.command("links");

links.usage("[options] [command] [GlobalOptions]").description(" > > > Help-Links for Skynet < < < ");

links
  .command("blog")
  .usage("[options] [GlobalOptions]")
  .description("Skynet/Sia Blog open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://blog.sia.tech/";
    await open(url);
    console.log("Skynet/Sia Blog open in default browser successful");
  });

links
  .command("discord_sia")
  .usage("[options] [GlobalOptions]")
  .description("Sia Foundation on Discord open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://discord.gg/sia";
    await open(url);
    console.log("Sia Foundation on Discord open in default browser successful");
  });

links
  .command("discord_sky")
  .usage("[options] [GlobalOptions]")
  .description("SkynetLabs on Discord open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://discord.gg/skynetlabs";
    await open(url);
    console.log("SkynetLabs on Discord open in default browser successful");
  });

links
  .command("github")
  .usage("[options] [GlobalOptions]")
  .description("SkynetLabs on Github open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://github.com/SkynetLabs";
    await open(url);
    console.log("SkynetLabs on Github open in default browser successful");
  });

links
  .command("gitlab")
  .usage("[options] [GlobalOptions]")
  .description("SkynetLabs on Gitlab open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://gitlab.com/SkynetLabs";
    await open(url);
    console.log("SkynetLabs on Gitlab open in default browser successful");
  });

links
  .command("portal1")
  .usage("[options] [GlobalOptions]")
  .description(
    "Opening the Portal siasky.net in default browser. Completely open access. Anyone can upload or download without an account."
  )
  .action(async () => {
    setGlobalOptions();
    const url = "https://siasky.net/";
    await open(url);
    console.log("Opening the Portal siasky.net in default browser successful");
  });

links
  .command("portal2")
  .usage("[options] [GlobalOptions]")
  .description("Opening the Portal skynetfree.net in default browser. Free to use, but an account is required.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://skynetfree.net/";
    await open(url);
    console.log("Opening the Portal skynetfree.net in default browser successful");
  });

links
  .command("portal3")
  .usage("[options] [GlobalOptions]")
  .description(
    "Opening the Portal skynetpro.net in default browser. Requires a monthly subscription paid by credit card."
  )
  .action(async () => {
    setGlobalOptions();
    const url = "https://skynetpro.net/";
    await open(url);
    console.log("Opening the Portal skynetpro.net in default browser successful");
  });

links
  .command("portal4")
  .usage("[options] [GlobalOptions]")
  .description(
    "Opening the Portal web3portal.com in default browser. Free to use, and a monthly subscription paid by credit card."
  )
  .action(async () => {
    setGlobalOptions();
    const url = "https://web3portal.com/";
    await open(url);
    console.log("Opening the Portal web3portal.com in default browser successful");
  });

links
  .command("sdk")
  .usage("[options] [GlobalOptions]")
  .description("SDK-Documention form Skynet open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://sdk.skynetlabs.com/";
    await open(url);
    console.log("SDK-Documention form Skynet open in default browser successful");
  });

links
  .command("sia")
  .usage("[options] [GlobalOptions]")
  .description("Sia.tech Website open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://sia.tech/";
    await open(url);
    console.log("Sia.tech Website open in default browser successful");
  });

links
  .command("sia_101info")
  .usage("[options] [GlobalOptions]")
  .description("Sia 101 Infographic open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://siastats.info/sia101";
    await open(url);
    console.log("Sia 101 Infographic open in default browser successful");
  });

links
  .command("sia_support")
  .usage("[options] [GlobalOptions]")
  .description("Support Center form Sia.tech open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://support.sia.tech/";
    await open(url);
    console.log("Support Center form Sia.tech open in default browser successful");
  });

links
  .command("skyapps")
  .usage("[options] [GlobalOptions]")
  .description("The Skynet AppStore open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://skyapps.hns.siasky.net/";
    await open(url);
    console.log("The Skynet AppStore open in default browser successful");
  });

links
  .command("twitter_sia")
  .usage("[options] [GlobalOptions]")
  .description("Sia Foundation on Twitter open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://twitter.com/Sia__Foundation";
    await open(url);
    console.log("Sia Foundation on Twitter open in default browser successful");
  });

links
  .command("twitter_sky")
  .usage("[options] [GlobalOptions]")
  .description("SkynetLabs on Twitter open in default browser.")
  .action(async () => {
    setGlobalOptions();
    const url = "https://twitter.com/SkynetLabs";
    await open(url);
    console.log("SkynetLabs on Twitter open in default browser successful");
  });

// ############ pin #################
const pin = program.command("pin");

pin.usage("[options] [command] [GlobalOptions]").description("Pinning a Skylink to Skynet");

pin
  .command("pinSkylink")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Pinning a Skylink to a Portal on Skynet")
  .argument("<skylink>", "The skylink that should be pin to a Portal.")
  .action(async (skylink) => {
    setGlobalOptions();
    const { skylink: skylink2 } = await client.pinSkylink(skylink);
    console.log("Pinned skylink: " + skylink2);
    console.log("Pinning a Skylink to a Portal on Skynet successful");
  });

// ############ registry #################
const registry = program.command("registry");

registry.usage("[options] [command] [GlobalOptions]").description("Registry");

registry
  .command("getEntry")
  .usage("[options] <publicKey> <dataKey> [GlobalOptions]")
  .description("Getting Data From The Registry")
  .argument(
    "<publicKey>",
    "Users public key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .option("-s, --seed", "A long secure seed instead of <publicKey>.")
  .action(async (publicKey, dataKey, options) => {
    setGlobalOptions();

    if (options.seed) {
      const { publicKey: publicKeyFromSeed } = genKeyPairFromSeed(publicKey);

      const { entry, signature } = await client.registry.getEntry(publicKeyFromSeed, dataKey);
      const signature2 = Buffer.from(signature);
      console.log("entry: " + JSON.stringify(entry));
      console.log("signature: " + signature2.toString("hex"));
      console.log("Getting Data From The Registry with Seed successful.");
    }

    if (!options.seed) {
      const { entry, signature } = await client.registry.getEntry(publicKey, dataKey);
      const signature2 = Buffer.from(signature);
      console.log("entry: " + JSON.stringify(entry));
      console.log("signature: " + signature2.toString("hex"));
      console.log("Getting Data From The Registry successful.");
    }
  });

registry
  .command("getEntryLink")
  .usage("[options] <publicKey> <dataKey> [GlobalOptions]")
  .description("Getting The Entry Link")
  .argument(
    "<publicKey>",
    "Users public key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .option("-s, --seed", "A long secure seed instead of <publicKey>.")
  .action(async (publicKey, dataKey, options) => {
    setGlobalOptions();

    if (options.seed) {
      const { publicKey: publicKeyFromSeed } = genKeyPairFromSeed(publicKey);

      const entryLink = await client.registry.getEntryLink(publicKeyFromSeed, dataKey);
      console.log("EntryLink: " + entryLink);
      console.log("Getting The Entry Link with Seed successful.");
    }

    if (!options.seed) {
      const entryLink = await client.registry.getEntryLink(publicKey, dataKey);
      console.log("EntryLink: " + entryLink);
      console.log("Getting The Entry Link successful.");
    }
  });

registry
  .command("getEntryUrl")
  .usage("[options] <publicKey> <dataKey> [GlobalOptions]")
  .description("Getting The Entry URL")
  .argument(
    "<publicKey>",
    "Users public key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .option("-s, --seed", "A long secure seed instead of <publicKey>.")
  .action(async (publicKey, dataKey, options) => {
    setGlobalOptions();

    if (options.seed) {
      const { publicKey: publicKeyFromSeed } = genKeyPairFromSeed(publicKey);

      const url = await client.registry.getEntryUrl(publicKeyFromSeed, dataKey);
      console.log("Url: " + url);
      console.log("Getting The Entry URL with Seed successful.");
    }

    if (!options.seed) {
      const url = await client.registry.getEntryUrl(publicKey, dataKey);
      console.log("Url: " + url);
      console.log("Getting The Entry URL successful.");
    }
  });

registry
  .command("postSignedEntry")
  .usage("[options] <publicKey> <dataKey> [GlobalOptions]")
  .description("Posting the Signed Entry")
  .argument(
    "<publicKey>",
    "Users public key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .option("-s, --seed", "A long secure seed instead of <publicKey>.")
  .action(async (publicKey, dataKey, options) => {
    setGlobalOptions();

    if (options.seed) {
      const { publicKey: publicKeyFromSeed } = genKeyPairFromSeed(publicKey);
      const { entry, signature } = await client.registry.getEntry(publicKeyFromSeed, dataKey);

      await client.registry.postSignedEntry(publicKeyFromSeed, entry, signature);
      console.log("Posting the Signed Entry with Seed successful.");
    }

    if (!options.seed) {
      const { entry, signature } = await client.registry.getEntry(publicKey, dataKey);
      await client.registry.postSignedEntry(publicKey, entry, signature);
      console.log("Posting the Signed Entry successful.");
    }
  });

registry
  .command("setEntry")
  .usage("[options] <privateKey> <dataKey> <data> <revision> [GlobalOptions]")
  .description("Setting Data On The Registry")
  .argument(
    "<privateKey>",
    "User's private key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data for the given entry.")
  .argument("<data>", "The data for this entry. Capped at 113 bytes, but can be a skylink or an HNS domain.")
  .argument(
    "<revision>",
    "The revision number of this entry. \nIt must be at least 1 more than the latest revision number, or 0 if the entry doesn't exist."
  )
  .option("-s, --seed", "A long secure seed instead of <privateKey>.")
  .action(async (privateKey, dataKey, data, revision, options) => {
    setGlobalOptions();
    const u8aData = Uint8Array.from(Buffer.from(data));
    const entry = { dataKey, data: u8aData, revision: BigInt(revision) };

    if (options.seed) {
      const { privateKey: privateKeyFromSeed } = genKeyPairFromSeed(privateKey);
      await client.registry.setEntry(privateKeyFromSeed, entry);
      console.log("Setting Data On The Registry with Seed successful.");
    }

    if (!options.seed) {
      await client.registry.setEntry(privateKey, entry);
      console.log("Setting Data On The Registry successful.");
    }
  });

// ############ SkyDB #################
const skydb = program.command("skydb");

skydb.usage("[options] [command] [GlobalOptions]").description("SkyDB v1/v2 from Skynet");

skydb
  .command("deleteEntryData")
  .usage("[options] <privateKey> <dataKey> [GlobalOptions]")
  .description("Delete the EntryData.")
  .argument(
    "<privateKey>",
    "Users private key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .option("-s, --seed", "A long secure seed instead of <privatekey>.")
  .option("--v1", "SkyDB v1 Function (deprecated).")
  .action(async (privateKey, dataKey, options) => {
    setGlobalOptions();

    if (options.seed) {
      const { privateKey: privateKeyFromSeed } = genKeyPairFromSeed(privateKey);

      if (options.v1) {
        await client.db.deleteEntryData(privateKeyFromSeed, dataKey);
        console.log("Delete the EntryData from SkyDB v1 with Seed successful.");
      }

      if (!options.v1) {
        const publicKey = privateKeyFromSeed.slice(64);
        await client.dbV2.getJSON(publicKey, dataKey);
        await client.dbV2.deleteEntryData(privateKeyFromSeed, dataKey);
        console.log("Delete the EntryData From SkyDB with Seed successful.");
      }
    }

    if (!options.seed) {
      if (options.v1) {
        await client.db.deleteEntryData(privateKey, dataKey);
        console.log("Delete the EntryData from SkyDB v1 successful.");
      }

      if (!options.v1) {
        const publicKey = privateKey.slice(64);
        await client.dbV2.getJSON(publicKey, dataKey);
        await client.dbV2.deleteEntryData(privateKey, dataKey);
        console.log("Delete the EntryData From SkyDB successful.");
      }
    }
  });

skydb
  .command("deleteJSON")
  .usage("[options] <privateKey> <dataKey> [GlobalOptions]")
  .description("Deleting Data From SkyDB")
  .argument(
    "<privateKey>",
    "Users private key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .option("-s, --seed", "A long secure seed instead of <privatekey>.")
  .option("--v1", "SkyDB v1 Function (deprecated).")
  .action(async (privateKey, dataKey, options) => {
    setGlobalOptions();
    if (options.seed) {
      const { privateKey: privateKeyFromSeed } = genKeyPairFromSeed(privateKey);
      if (options.v1) {
        await client.db.deleteJSON(privateKeyFromSeed, dataKey);
        console.log("Deleting Data From SkyDB v1 with Seed successful.");
      }

      if (!options.v1) {
        const publicKey = privateKeyFromSeed.slice(64);
        await client.dbV2.getJSON(publicKey, dataKey);
        await client.dbV2.deleteJSON(privateKeyFromSeed, dataKey);
        console.log("Deleting Data From SkyDB with Seed successful.");
      }
    }

    if (!options.seed) {
      if (options.v1) {
        await client.db.deleteJSON(privateKey, dataKey);
        console.log("Deleting Data From SkyDB v1 successful.");
      }

      if (!options.v1) {
        const publicKey = privateKey.slice(64);
        await client.dbV2.getJSON(publicKey, dataKey);
        await client.dbV2.deleteJSON(privateKey, dataKey);
        console.log("Deleting Data From SkyDB successful.");
      }
    }
  });

skydb
  .command("getEntryData")
  .usage("[options] <publicKey> <dataKey> [GlobalOptions]")
  .description("Get the EntryData.")
  .argument(
    "<publicKey>",
    "Users public key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .option("-s, --seed", "A long secure seed instead of <privatekey>.")
  .option("--v1", "SkyDB v1 Function (deprecated).")
  .action(async (publicKey, dataKey, options) => {
    setGlobalOptions();

    if (options.seed) {
      const { publicKey: publicKeyFromSeed } = genKeyPairFromSeed(publicKey);

      if (options.v1) {
        const data = await client.db.getEntryData(publicKeyFromSeed, dataKey);
        console.log("Retrieved EntryData: " + data["data"]);
        console.log("Get the EntryData from SkyDB v1 with Seed successful.");
      }

      if (!options.v1) {
        const data = await client.dbV2.getEntryData(publicKeyFromSeed, dataKey);
        console.log("Retrieved EntryData: " + data["data"]);
        console.log("Get the EntryData From SkyDB with Seed successful.");
      }
    }

    if (!options.seed) {
      if (options.v1) {
        const data = await client.db.getEntryData(publicKey, dataKey);
        console.log("Retrieved EntryData: " + data["data"]);
        console.log("Get the EntryData from SkyDB v1 successful.");
      }

      if (!options.v1) {
        const data = await client.dbV2.getEntryData(publicKey, dataKey);
        console.log("Retrieved EntryData: " + data["data"]);
        console.log("Get the EntryData From SkyDB successful.");
      }
    }
  });

skydb
  .command("getJSON")
  .usage("[options] <publicKey> <dataKey> [GlobalOptions]")
  .description("Getting Data From SkyDB")
  .argument(
    "<publicKey>",
    "Users public key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .option(
    "-l, --localJsonPath <localJsonPath>",
    "The local path where the JsonFile should be save to instead console output."
  )
  .option("-s, --seed", "A long secure seed instead of <publicKey>.")
  .option("--v1", "SkyDB v1 Function (deprecated).")
  .action(async (publicKey, dataKey, options) => {
    setGlobalOptions();
    if (options.seed) {
      const { publicKey: publicKeyFromSeed } = genKeyPairFromSeed(publicKey);

      if (options.localJsonPath) {
        if (options.v1) {
          const { data, dataLink } = await client.db.getJSON(publicKeyFromSeed, dataKey);

          let jsondata = JSON.stringify(data);
          fs.writeFileSync(options.localJsonPath, jsondata);
          console.log("DataLink: " + dataLink);
          console.log("Getting Data From SkyDB v1 saved successful.");
        }

        if (!options.v1) {
          const { data, dataLink } = await client.dbV2.getJSON(publicKeyFromSeed, dataKey);
          let jsondata = JSON.stringify(data);
          fs.writeFileSync(options.localJsonPath, jsondata);
          console.log("DataLink: " + dataLink);
          console.log("Getting Data From SkyDB saved successful.");
        }
      }

      if (!options.localJsonPath) {
        if (options.v1) {
          const { data, dataLink } = await client.db.getJSON(publicKeyFromSeed, dataKey);
          console.log("Data: " + JSON.stringify(data));
          console.log("DataLink: " + dataLink);
          console.log("Getting Data From SkyDB v1 successful.");
        }

        if (!options.v1) {
          const { data, dataLink } = await client.dbV2.getJSON(publicKeyFromSeed, dataKey);
          console.log("Data: " + JSON.stringify(data));
          console.log("DataLink: " + dataLink);
          console.log("Getting Data From SkyDB successful.");
        }
      }
    }

    if (!options.seed) {
      if (options.localJsonPath) {
        if (options.v1) {
          const { data, dataLink } = await client.db.getJSON(publicKey, dataKey);
          let jsondata = JSON.stringify(data);
          fs.writeFileSync(options.localJsonPath, jsondata);
          console.log("DataLink: " + dataLink);
          console.log("Getting Data From SkyDB v1 saved successful.");
        }

        if (!options.v1) {
          const { data, dataLink } = await client.dbV2.getJSON(publicKey, dataKey);
          let jsondata = JSON.stringify(data);
          fs.writeFileSync(options.localJsonPath, jsondata);
          console.log("DataLink: " + dataLink);
          console.log("Getting Data From SkyDB saved successful.");
        }
      }

      if (!options.localJsonPath) {
        if (options.v1) {
          const { data, dataLink } = await client.db.getJSON(publicKey, dataKey);
          console.log("Data: " + JSON.stringify(data));
          console.log("DataLink: " + dataLink);
          console.log("Getting Data From SkyDB v1 successful.");
        }

        if (!options.v1) {
          const { data, dataLink } = await client.dbV2.getJSON(publicKey, dataKey);
          console.log("Data: " + JSON.stringify(data));
          console.log("DataLink: " + dataLink);
          console.log("Getting Data From SkyDB successful.");
        }
      }
    }
  });

skydb
  .command("getRawBytes")
  .usage("[options] <publicKey> <dataKey> [GlobalOptions]")
  .description("Get the RawBytes.")
  .argument(
    "<publicKey>",
    "Users public key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .option("-s, --seed", "A long secure seed instead of <publicKey>.")
  .option("--v1", "SkyDB v1 Function (deprecated).")
  .action(async (publicKey, dataKey, options) => {
    setGlobalOptions();

    if (options.seed) {
      const { publicKey: publicKeyFromSeed } = genKeyPairFromSeed(publicKey);

      if (options.v1) {
        const data = await client.db.getRawBytes(publicKeyFromSeed, dataKey);
        console.log("Retrieved EntryData: " + data["data"]);
        console.log("Retrieved dataLink: " + data["dataLink"]);
        console.log("Get the RawBytes from SkyDB v1 with Seed successful.");
      }

      if (!options.v1) {
        const data = await client.dbV2.getRawBytes(publicKeyFromSeed, dataKey);
        console.log("Retrieved EntryData: " + data["data"]);
        console.log("Retrieved dataLink: " + data["dataLink"]);
        console.log("Get the RawBytes From SkyDB with Seed successful.");
      }
    }

    if (!options.seed) {
      if (options.v1) {
        const data = await client.db.getRawBytes(publicKey, dataKey);
        console.log("Retrieved EntryData: " + data["data"]);
        console.log("Retrieved dataLink: " + data["dataLink"]);
        console.log("Get the RawBytes from SkyDB v1 successful.");
      }

      if (!options.v1) {
        const data = await client.dbV2.getRawBytes(publicKey, dataKey);
        console.log("Retrieved EntryData: " + data["data"]);
        console.log("Retrieved dataLink: " + data["dataLink"]);
        console.log("Get the RawBytes From SkyDB successful.");
      }
    }
  });

skydb
  .command("setDataLink")
  .usage("[options] <privateKey> <dataKey> <dataLink> [GlobalOptions]")
  .description("Set the DataLink for Data.")
  .argument(
    "<privateKey>",
    "Users private key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .argument("<dataLink>", "The dataLink from the data.")
  .option("-s, --seed", "A long secure seed instead of <privatekey>.")
  .option("--v1", "SkyDB v1 Function (deprecated).")
  .action(async (privateKey, dataKey, dataLink, options) => {
    setGlobalOptions();
    if (options.seed) {
      const { privateKey: privateKeyFromSeed } = genKeyPairFromSeed(privateKey);

      if (options.v1) {
        await client.db.setDataLink(privateKeyFromSeed, dataKey, dataLink);
        console.log("Set the DataLink for Data from SkyDB v1 with Seed successful.");
      }

      if (!options.v1) {
        const publicKey = privateKeyFromSeed.slice(64);
        await client.dbV2.getJSON(publicKey, dataKey);
        await client.dbV2.setDataLink(privateKeyFromSeed, dataKey, dataLink);
        console.log("Set the DataLink for Data From SkyDB with Seed successful.");
      }
    }

    if (!options.seed) {
      if (options.v1) {
        await client.db.setDataLink(privateKey, dataKey, dataLink);
        console.log("Set the DataLink for Data from SkyDB v1 successful.");
      }

      if (!options.v1) {
        const publicKey = privateKey.slice(64);
        await client.dbV2.getJSON(publicKey, dataKey);
        await client.dbV2.setDataLink(privateKey, dataKey, dataLink);
        console.log("Set the DataLink for Data From SkyDB successful.");
      }
    }
  });

skydb
  .command("setEntryData")
  .usage("[options] <privateKey> <dataKey> <rawEntryData> [GlobalOptions]")
  .description("Set the EntryData.")
  .argument(
    "<privateKey>",
    "Users private key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .argument("<rawEntryData>", "The rawEntryData as String.")
  .option("-s, --seed", "A long secure seed instead of <privatekey>.")
  .option("--v1", "SkyDB v1 Function (deprecated).")
  .action(async (privateKey, dataKey, rawEntryData, options) => {
    setGlobalOptions();

    const arrayRawEntryData = rawEntryData.split(",");
    const u8aRawEntryData = Uint8Array.from(arrayRawEntryData);

    if (options.seed) {
      const { privateKey: privateKeyFromSeed } = genKeyPairFromSeed(privateKey);

      if (options.v1) {
        await client.db.setEntryData(privateKeyFromSeed, dataKey, u8aRawEntryData);
        console.log("Set the EntryData from SkyDB v1 with Seed successful.");
      }

      if (!options.v1) {
        const publicKey = privateKeyFromSeed.slice(64);
        await client.dbV2.getJSON(publicKey, dataKey);
        await client.dbV2.setEntryData(privateKeyFromSeed, dataKey, u8aRawEntryData);
        console.log("Set the EntryData From SkyDB with Seed successful.");
      }
    }

    if (!options.seed) {
      if (options.v1) {
        await client.db.setEntryData(privateKey, dataKey, u8aRawEntryData);
        console.log("Set the EntryData from SkyDB v1 successful.");
      }

      if (!options.v1) {
        const publicKey = privateKey.slice(64);
        await client.dbV2.getJSON(publicKey, dataKey);
        await client.dbV2.setEntryData(privateKey, dataKey, u8aRawEntryData);
        console.log("Set the EntryData From SkyDB successful.");
      }
    }
  });

skydb
  .command("setJSON")
  .usage("[options] <privateKey> <dataKey> <json> [GlobalOptions]")
  .description("Setting Data to SkyDB")
  .argument(
    "<privateKey>",
    "Users private key as a hex-encoded string. Can be generated with the genKeyPairFromSeed function."
  )
  .argument("<dataKey>", "The key of the data to fetch for the given user.")
  .argument("<json>", "The JSON object to set for the given private key and data key.")
  .option("-j, --jsonFile", "The local path where the jsonfile may be found instead of <json>.")
  .option("-s, --seed", "A long secure seed instead of <privatekey>.")
  .option("--v1", "SkyDB v1 Function (deprecated).")
  .action(async (privateKey, dataKey, json, options) => {
    setGlobalOptions();
    if (options.seed) {
      if (options.jsonFile) {
        const rawJSONdata = fs.readFileSync(json);
        const jsonFile = JSON.parse(rawJSONdata);

        const { privateKey: privateKeyFromSeed } = genKeyPairFromSeed(privateKey);
        if (options.v1) {
          await client.db.setJSON(privateKeyFromSeed, dataKey, jsonFile);
          console.log("Setting Data to SkyDB v1 with Seed loaded successful.");
        }

        if (!options.v1) {
          const publicKey = privateKeyFromSeed.slice(64);
          await client.dbV2.getJSON(publicKey, dataKey);
          await client.dbV2.setJSON(privateKeyFromSeed, dataKey, jsonFile);
          console.log("Setting Data to SkyDB1 with Seed loaded successful.");
        }
      }

      if (!options.jsonFile) {
        const { privateKey: privateKeyFromSeed } = genKeyPairFromSeed(privateKey);
        if (options.v1) {
          await client.db.setJSON(privateKeyFromSeed, dataKey, json);
          console.log("Setting Data to SkyDB v11 with Seed successful.");
        }

        if (!options.v1) {
          const publicKey = privateKeyFromSeed.slice(64);
          await client.dbV2.getJSON(publicKey, dataKey);
          await client.dbV2.setJSON(privateKeyFromSeed, dataKey, json);
          console.log("Setting Data to SkyDB1 with Seed successful.");
        }
      }
    }

    if (!options.seed) {
      if (options.jsonFile) {
        const rawJSONdata = fs.readFileSync(json);
        const jsonFile = JSON.parse(rawJSONdata);

        if (options.v1) {
          await client.db.setJSON(privateKey, dataKey, jsonFile);
          console.log("Setting Data to SkyDB v1 loaded successful.");
        }

        if (!options.v1) {
          const publicKey = privateKey.slice(64);
          await client.dbV2.getJSON(publicKey, dataKey);
          await client.dbV2.setJSON(privateKey, dataKey, jsonFile);
          console.log("Setting Data to SkyDB loaded successful.");
        }
      }

      if (!options.jsonFile) {
        if (options.v1) {
          await client.db.setJSON(privateKey, dataKey, json);
          console.log("Setting Data to SkyDB v1 successful.");
        }

        if (!options.v1) {
          const publicKey = privateKey.slice(64);
          await client.dbV2.getJSON(publicKey, dataKey);
          await client.dbV2.setJSON(privateKey, dataKey, json);
          console.log("Setting Data to SkyDB successful.");
        }
      }
    }
  });

// ############ Upload #################
const upload = program.command("upload");

upload
  .usage("[options] [command] [GlobalOptions]")
  .description("Uploading a  Data-String / Directory / File to Skynet");

upload
  .command("uploadData")
  .usage("[options] <data> [GlobalOptions]")
  .description("Uploading a  Data-String to Skynet")
  .argument("<data>", "The Data-String to upload.")
  .argument("<filename>", "The filename for the Data-String to upload.")
  .action(async (data, filename) => {
    setGlobalOptions();
    const skylink = await client.uploadData(data, filename);
    console.log("Skylink: " + skylink);
    console.log("Uploading a Data-String to Skynet successful.");
  });

upload
  .command("uploadDirectory")
  .usage("[options] <localpath> [GlobalOptions]")
  .description("Uploading a Directory to Skynet")
  .argument("<localpath>", "The local path where the directory to upload may be found.")
  .action(async (localpath) => {
    setGlobalOptions();
    const skylink = await client.uploadDirectory(localpath);
    console.log("Skylink: " + skylink);
    console.log("Uploading a Directory to Skynet successful.");
  });

upload
  .command("uploadFile")
  .usage("[options] <localpath> [GlobalOptions]")
  .description("Uploading a File to Skynet")
  .argument("<localpath>", "The local path where the file to upload may be found.")
  .action(async (localpath) => {
    setGlobalOptions();
    await client
      .uploadFile(localpath)
      .then((skylink) => {
        console.log("\nSkylink: " + skylink);
        console.log("Uploading a File to Skynet successful.");
      })
      .catch((err) => {
        console.log("Error: ", err);
      });
  });

// ############ utils #################
const utils = program.command("utils");
const genkeys = utils.command("genkeys");
utils.usage("[options] [command] [GlobalOptions]").description("Many Helper Commands.");

utils
  .command("convertSkylinkToBase32")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Converts the given base64 skylink to base32 for Skynet")
  .argument(
    "<skylink>",
    "The skylink that should be downloaded. The skylink can contain an optional path. \nThis path can specify a directory or a particular file. If specified, only that file or directory will be returned."
  )
  .action(async (skylink) => {
    setGlobalOptions();
    const base32Skylink = await convertSkylinkToBase32(skylink);
    if (base32Skylink) {
      console.log("Base32-Skylink: " + base32Skylink);
      console.log("Url: https://" + base32Skylink + ".siasky.net/");
      console.log("Converts the given base64 skylink to base32 for Skynet successful.");
    }
  });

utils
  .command("convertSkylinkToBase64")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Converts the given base32 skylink to base64 for Skynet")
  .argument(
    "<skylink>",
    "The skylink that should be downloaded. The skylink can contain an optional path. \nThis path can specify a directory or a particular file. If specified, only that file or directory will be returned."
  )
  .action(async (skylink) => {
    setGlobalOptions();

    if (globalPortal) {
      const base64Skylink = await convertSkylinkToBase64(skylink);
      if (base64Skylink) {
        console.log("Base64-Skylink: " + base64Skylink);
        base64Skylink;
        console.log("Converts the given base32 skylink to base64 for Skynet successful.");
      }
    }

    if (!globalPortal) {
      const base64Skylink = await convertSkylinkToBase64(skylink);
      if (base64Skylink) {
        console.log("Base64-Skylink: " + base64Skylink);
        console.log("Url: https://siasky.net/" + base64Skylink);
        console.log("Converts the given base32 skylink to base64 for Skynet successful.");
      }
    }
  });

utils
  .command("getMetadata")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting Metadata from a skylink")
  .argument(
    "<skylink>",
    "The skylink that should be downloaded. The skylink can contain an optional path. \nThis path can specify a directory or a particular file. If specified, only that file or directory will be returned."
  )
  .action(async (skylink) => {
    setGlobalOptions();
    const md = await client.getMetadata(skylink);
    if (md) {
      console.log("Metadata: " + JSON.stringify(md));
      console.log("Getting Metadata from a skylink successful.");
    }
  });

utils
  .command("getSkylinkUrl")
  .usage("[options] <skylink> [GlobalOptions]")
  .description("Getting Url from Skylink")
  .argument("<skylink>", "The skylink that should be get as Url.")
  .action(async (skylink) => {
    setGlobalOptions();
    const url = await client.getSkylinkUrl(skylink);
    if (url) {
      console.log("Url: " + url);
      console.log("Getting Url from Skylink successful.");
    }
  });

utils
  .command("openFile")
  .usage("[options] <skylink> [GlobalOptions]")
  .summary("Opening A File in Browser")
  .description(
    "Use the client to open a  in a new browser tab. \nBrowsers support opening natively only limited file extensions like .html or .jpg and will fallback to downloading the file."
  )
  .argument("<skylink>", "The skylink that should be open as Url.")
  .action(async (skylink) => {
    setGlobalOptions();
    await open(skylink);
    console.log("Opening A File in Browser successful.");
  });

utils
  .command("openFileHns")
  .usage("[options] <domain> [GlobalOptions]")
  .summary("Opening A Handshake domain in Browser")
  .description("Use the client to open a Handshake domain in a new browser tab.")
  .argument("<domain>", "The Handshake domain that should be open as Url.")
  .action(async (domain) => {
    setGlobalOptions();
    const url = await client.getHnsUrl(domain);
    if (url) {
      console.log("Url: " + url);
      await open(url);
      console.log("Opening A Handshake domain in Browser successful.");
    }
  });

utils
  .command("parseSkylink")
  .usage("[options] <string> [GlobalOptions]")
  .description("Extract a skylink from a string")
  .argument("<string>", "The string to extract a skylink from.")
  .action(async (string) => {
    setGlobalOptions();
    const skylink = await parseSkylink(string);
    if (skylink) {
      console.log("Skylink: " + skylink);
      console.log("Extract a skylink from a string successful.");
    }
  });

// ############ utils genkeys #################
utils;
genkeys
  .usage("[options] [command] [GlobalOptions]")
  .summary("Generating Keys")
  .description("Generating Keys with different commands");

utils;
genkeys
  .command("genKeyPairAndSeed")
  .usage("[options] [GlobalOptions]")
  .summary("Generating Key Pairs And Seeds")
  .description(
    "Generating Key Pairs And Seeds, \nIf you do not yet have a seed, you can generate one with this function and it will also generate an associated key pair. \nThe seed is generated using strong, cryptographic-grade randomness. \nIt is recommended that you only store the seed for later use and re-derive the key pair with genKeyPairFromSeed, and that you store it securely."
  )
  .option("--save <localPath>", "The local path where the keysFile should be saved to.")
  .action(async (options) => {
    setGlobalOptions();
    const { publicKey, privateKey, seed } = genKeyPairAndSeed();

    if (options.save) {
      if (publicKey && privateKey && seed) {
        var data = `
Your publicKey  : ${publicKey}
Your privateKey : ${privateKey}
Your seed       : ${seed}
`;
        fs.writeFileSync(options.save, data);
        console.log("\nGenerating Key Pairs And Seeds saved successful.");
      }
    }

    if (!options.save) {
      if (publicKey && privateKey && seed) {
        console.log("\nSave manual your publicKey/privateKey and seed for later use.\n");
        console.log("Your publicKey  : " + publicKey);
        console.log("Your privateKey : " + privateKey);
        console.log("Your seed       : " + seed);
        console.log("\nGenerating Key Pairs And Seeds successful.");
      }
    }
  });

utils;
genkeys
  .command("genKeyPairFromSeed")
  .usage("[options] <seed> [GlobalOptions]")
  .summary("Generating Key Pairs From Seeds")
  .description(
    "Generating Key Pairs From Seeds, \nif you already have a seed (e.g. from a previous call to genKeyPairAndSeed) you can deterministically derive the same keypair."
  )
  .argument(
    "<seed>",
    "The seed that should be used to generate a deterministic keypair. Can be a long and secure passphrase."
  )
  .option("--save <localPath>", "The local path where the keysFile should be saved to.")
  .action(async (seed, options) => {
    setGlobalOptions();
    const { publicKey, privateKey } = genKeyPairFromSeed(seed);

    if (options.save) {
      if (publicKey && privateKey) {
        var data = `
Your publicKey  : ${publicKey}
Your privateKey : ${privateKey}
`;
        fs.writeFileSync(options.save, data);
        console.log("\nGenerating Key Pairs From Seeds saved successful.");
      }
    }

    if (!options.save) {
      if (publicKey && privateKey) {
        console.log("\nSave manual your publicKey and privateKey for later use.\n");
        console.log("Your publicKey  : " + publicKey);
        console.log("Your privateKey : " + privateKey);
        console.log("\nGenerating Key Pairs From Seeds successful.");
      }
    }
  });

utils;
genkeys
  .command("deriveChildSeed")
  .usage("[options] <masterSeed> <subseed> [GlobalOptions]")
  .summary("Deriving Child Seeds")
  .description(
    "Deriving Child Seeds, \nThis function can be used to derive a child seed from a given master seed and subseed. \nFor example, the master seed can be a long and secure passphrase while the subseed can be the name of an application."
  )
  .argument(
    "<masterSeed>",
    "The master seed that should be used to generate a deterministic keypair. Can be a long and secure passphrase."
  )
  .argument("<subseed>", "The subseed that, in combination with the master seed, results in a deterministic keypair.")
  .option("--save <localPath>", "The local path where the keysFile should be saved to.")
  .action(async (masterSeed, subseed, options) => {
    setGlobalOptions();
    const childSeed = deriveChildSeed(masterSeed, subseed);

    if (options.save) {
      if (childSeed) {
        var data = `
Your childSeed  : ${childSeed}
`;
        fs.writeFileSync(options.save, data);
        console.log("\nDeriving Child Seeds saved successful.");
      }
    }

    if (!options.save) {
      if (childSeed) {
        console.log("\nSave manual your childSeed for later use.\n");
        console.log("Your childSeed : " + childSeed);
        console.log("\nDeriving Child Seeds successful.");
      }
    }
  });

program.parseAsync(process.argv);

module.exports = program;
