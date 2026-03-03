
/**
 * Helper to parse ForexFactory XML feed using Regex
 * Service Workers don't support DOMParser, so we use a robust regex approach
 * The feed structure is very flat <event><title>...</title>...</event>
 */
class ForexFactoryParser {
    static parse(xmlText) {
        const events = [];
        // Regex to match each <event> block
        // Using [\s\S]*? for non-greedy match across newlines
        const eventRegex = /<event>([\s\S]*?)<\/event>/g;
        
        let match;
        while ((match = eventRegex.exec(xmlText)) !== null) {
            const content = match[1];
            
            // Extract fields
            const title = this._extractTag(content, 'title');
            const country = this._extractTag(content, 'country');
            const date = this._extractTag(content, 'date');
            const time = this._extractTag(content, 'time');
            const impact = this._extractTag(content, 'impact');
            const forecast = this._extractTag(content, 'forecast');
            const previous = this._extractTag(content, 'previous');
            
            // Filter: meaningful impact only (optional, but good for UI)
            if (title && date) {
                events.push({
                    title,
                    country,
                    date,
                    time,
                    impact,
                    forecast,
                    previous,
                    timestamp: new Date(`${date} ${time}`).getTime()
                });
            }
        }
        
        return events;
    }
    
    static _extractTag(content, tagName) {
        const regex = new RegExp(`<${tagName}><!\\[CDATA\\[(.*?)\\]\\]><\/${tagName}>`);
        const match = regex.exec(content);
        return match ? match[1] : '';
    }
}
