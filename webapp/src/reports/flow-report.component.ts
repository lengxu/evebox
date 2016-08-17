import {Component, OnInit} from "@angular/core";
import {ApiService} from "../api.service";
import {ElasticSearchService} from "../elasticsearch.service";

@Component({
    template: "flow"
})
export class FlowReportComponent implements OnInit {

    constructor(private api:ApiService,
                private elasticsearch:ElasticSearchService) {
    }

    ngOnInit() {
        this.refresh();
    }

    refresh() {
        let query:any = {
            query: {
                filtered: {
                    filter: {
                        and: [
                            // Somewhat limit to eve events only.
                            {exists: {field: "event_type"}},

                            {term: {event_type: "flow"}}
                        ]
                    }
                }
            },
            size: 0,
            sort: [
                {"@timestamp": {order: "desc"}}
            ],
            aggs: {
                events_over_time: {
                    date_histogram: {
                        field: "@timestamp",
                        interval: "minute"
                    },
                    aggs: {
                        bytes_toserver: {
                            sum: {
                                field: "flow.bytes_toserver"
                            }
                        },
                        bytes_toclient: {
                            sum: {
                                field: "flow.bytes_toclient"
                            }
                        },
                        pkts_toserver: {
                            sum: {
                                field: "flow.pkts_toserver"
                            }
                        },
                        pkts_toclient: {
                            sum: {
                                field: "flow.pkts_toclient"
                            }
                        }
                    }
                }
            }
        };

        this.elasticsearch.search(query).then((response:any) => {
            console.log(response);
        })
    }
}