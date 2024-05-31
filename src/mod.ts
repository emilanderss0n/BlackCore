import { DependencyContainer }  from "tsyringe";
import { IPostDBLoadMod }       from "@spt-aki/models/external/IPostDBLoadMod";
import { DatabaseServer }       from "@spt-aki/servers/DatabaseServer";
import { ImporterUtil }         from "@spt-aki/utils/ImporterUtil";
import { ILogger }              from "@spt-aki/models/spt/utils/ILogger";
import { ICoreDatabase }        from "@spt-aki/atlas/ICoreDatabase";
import { PreAkiModLoader }      from "@spt-aki/loaders/PreAkiModLoader";
import { IDatabaseTables }      from "@spt-aki/models/spt/server/IDatabaseTables";
import { JsonUtil }             from "@spt-aki/utils/JsonUtil"


class BlackCore implements IPostDBLoadMod 
{
    private db:         IDatabaseTables;
    private mydb:       ICoreDatabase;
    private logger:     ILogger;
    private jsonUtil:   JsonUtil;

    public postDBLoad(container: DependencyContainer): void 
    {
        this.logger =               container.resolve<ILogger>("WinstonLogger");
        this.jsonUtil =             container.resolve<JsonUtil>("JsonUtil");

        const databaseServer =      container.resolve<DatabaseServer>("DatabaseServer");
        const databaseImporter =    container.resolve<ImporterUtil>("ImporterUtil");
        const modLoader =           container.resolve<PreAkiModLoader>("PreAkiModLoader");

        const modFolderName =   "MoxoPixel-BlackCore";

        const traders = {
            "painter":     "PAINTERSHOP"
        };

        this.db = databaseServer.getTables();
        this.mydb = databaseImporter.loadRecursive(`${modLoader.getModPath(modFolderName)}database/`);

        for (const newItem in this.mydb.items)
        {
            this.cloneItem(this.mydb.items[newItem].clone, newItem);
            this.addCompatibilitiesAndConflicts(this.mydb.items[newItem].clone, newItem);
        
            const newItemLocales = this.mydb.items[newItem].locales;
            for (const lang in this.db.locales.global) 
            {
                this.db.locales.global[lang][`${newItem} Name`] = newItemLocales.Name;
                this.db.locales.global[lang][`${newItem} ShortName`] = newItemLocales.Shortname;
                this.db.locales.global[lang][`${newItem} Description`] = newItemLocales.Description;
            }
        }
        for (const trader in traders) this.addTraderAssort(traders[trader]);

        const dbMastering = this.db.globals.config.Mastering;
        for (const weapon in dbMastering)
        {
            if (dbMastering[weapon].Name == "M4") dbMastering[weapon].Templates.push("0101_BLACK_LINES_M4A1", "0106_FLAMING_M4A1", "0107_PRISTINE_M4A1");
            if (dbMastering[weapon].Name == "AK74") dbMastering[weapon].Templates.push("0102_BLACK_LINES_AK103");
            if (dbMastering[weapon].Name == "R11SRASS") dbMastering[weapon].Templates.push("0103_BLACK_RSASS");
            if (dbMastering[weapon].Name == "MK47") dbMastering[weapon].Templates.push("0104_BLACK_LINES_MK47");
            if (dbMastering[weapon].Name == "AUG") dbMastering[weapon].Templates.push("0105_BLACK_AUG");
            if (dbMastering[weapon].Name == "SPEAR") dbMastering[weapon].Templates.push("0108_BLACK_SPEAR");
        }

        this.logger.info("------------------------");
        this.logger.info("Black Core Loaded");
    
    }

    private cloneItem(itemToClone: string, blackCoreID: string): void
    {
        if ( this.mydb.items[blackCoreID].enable == true )
        {
            let blackCoreItemOut = this.jsonUtil.clone(this.db.templates.items[itemToClone]);

            blackCoreItemOut._id = blackCoreID;
            blackCoreItemOut = this.compareAndReplace(blackCoreItemOut, this.mydb.items[blackCoreID]["items"]);

            const bcCompatibilities: object = (typeof this.mydb.items[blackCoreID].bcCompatibilities == "undefined") ? {} : this.mydb.items[blackCoreID].bcCompatibilities;
            const bcConflicts: Array<string> = (typeof this.mydb.items[blackCoreID].bcConflicts == "undefined")      ? [] : this.mydb.items[blackCoreID].bcConflicts;
            for (const modSlotName in bcCompatibilities)
            {
                for (const slot of blackCoreItemOut._props.Slots)
                {
                    if ( slot._name === modSlotName ) for (const id of bcCompatibilities[modSlotName]) slot._props.filters[0].Filter.push(id);
                }
            }
            blackCoreItemOut._props.ConflictingItems = blackCoreItemOut._props.ConflictingItems.concat(bcConflicts);

            this.db.templates.items[blackCoreID] = blackCoreItemOut;

            const handbookEntry = {
                "Id": blackCoreID,
                "ParentId": this.mydb.items[blackCoreID]["handbook"]["ParentId"],
                "Price": this.mydb.items[blackCoreID]["handbook"]["Price"]
            };

            this.db.templates.handbook.Items.push(handbookEntry);
        }
    }

    private compareAndReplace(originalItem, attributesToChange)
    {
        for (const key in attributesToChange)
        {
            if ( (["boolean", "string", "number"].includes(typeof attributesToChange[key])) || Array.isArray(attributesToChange[key]) )
            {
                if ( key in originalItem ) originalItem[key] = attributesToChange[key];
                else this.logger.error("Error finding the attribute: \"" + key + "\", default value is used instead.");
            } 
            else originalItem[key] = this.compareAndReplace(originalItem[key], attributesToChange[key]);
        }

        return originalItem;
    }

    private addCompatibilitiesAndConflicts(itemClone: string, blackCoreID: string): void
    {
        for (const item in this.db.templates.items)
        {
            if ( item in this.mydb.items ) continue;
            
            const slots = (typeof this.db.templates.items[item]._props.Slots === "undefined")            ? [] : this.db.templates.items[item]._props.Slots;
            const chambers = (typeof this.db.templates.items[item]._props.Chambers === "undefined")      ? [] : this.db.templates.items[item]._props.Chambers;
            const cartridges = (typeof this.db.templates.items[item]._props.Cartridges === "undefined")  ? [] : this.db.templates.items[item]._props.Cartridges;
            const combined = slots.concat(chambers, cartridges)

            for (const entry of combined)
            {
                for (const id of entry._props.filters[0].Filter)
                {
                    if ( id === itemClone ) entry._props.filters[0].Filter.push(blackCoreID);
                }
            }

            const conflictingItems = (typeof this.db.templates.items[item]._props.ConflictingItems === "undefined") ? [] : this.db.templates.items[item]._props.ConflictingItems;
            for (const conflictID of conflictingItems) if ( conflictID === itemClone ) conflictingItems.push(blackCoreID);
        }
    }

    private addTraderAssort(trader: string): void 
    {
        for (const item in this.mydb.traders[trader].assort.items) 
        {
            this.db.traders[trader].assort.items.push(this.mydb.traders[trader].assort.items[item]);
        }

        for (const item in this.mydb.traders[trader].assort.barter_scheme) 
        {
            this.db.traders[trader].assort.barter_scheme[item] = this.mydb.traders[trader].assort.barter_scheme[item];
        }

        for (const item in this.mydb.traders[trader].assort.loyal_level_items) 
        {
            this.db.traders[trader].assort.loyal_level_items[item] = this.mydb.traders[trader].assort.loyal_level_items[item];
        }
    }
}

module.exports = { mod: new BlackCore() }