export namespace main {
	
	export class FileData {
	    name: string;
	    path: string;
	    content: string;
	    baseDir: string;
	
	    static createFrom(source: any = {}) {
	        return new FileData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.content = source["content"];
	        this.baseDir = source["baseDir"];
	    }
	}
	export class RecentItem {
	    name: string;
	    path: string;
	    lastOpened: number;
	
	    static createFrom(source: any = {}) {
	        return new RecentItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.lastOpened = source["lastOpened"];
	    }
	}

}

