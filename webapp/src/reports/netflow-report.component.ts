/* Copyright (c) 2016 Jason Ish
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
 * IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import {Component, OnInit, OnDestroy} from "@angular/core";
import {EveboxMetricsGraphicComponent} from "../metricgraphics.component";
import {EveboxReportDataTable} from "./dns-report.component";
import {ReportsService} from "./reports.service";
import {EveboxSubscriptionService} from "../subscription.service";
import {AppService, AppEvent, AppEventCode} from "../app.service";
import {EveboxLoadingSpinnerComponent} from "../loading-spinner.component";
import {ToastrService} from "../toastr.service";
import {EveboxHumanizePipe} from "../pipes/humanize.pipe";
import {EveboxHumanizeService} from "../humanize.service";

import moment = require("moment");
import {EveboxEventTable2Component} from "../eventtable2.component";

@Component({
    template: `<div [ngClass]="{'evebox-opacity-50': loading > 0}">

  <loading-spinner [loading]="loading > 0"></loading-spinner>

  <div *ngIf="noEvents" style="text-align: center;">
    <hr/>
    No netflow events found.
    <hr/>
  </div>

  <metrics-graphic *ngIf="eventsOverTime"
                   graphId="eventsOverTime"
                   title="Netflow Events Over Time"
                   [data]="eventsOverTime"></metrics-graphic>

  <div class="row">

    <div class="col-md-6">

      <report-data-table *ngIf="topSourcesByBytes"
                         title="Top Sources by Bytes"
                         [rows]="topSourcesByBytes"
                         [headers]="['#', 'Source']"></report-data-table>

      <report-data-table *ngIf="topSourcesByPackets"
                         title="Top Sources by Packets"
                         [rows]="topSourcesByPackets"
                         [headers]="['#', 'Source']">
      </report-data-table>

     </div>

    <div class="col-md-6">

      <report-data-table *ngIf="topDestinationsByBytes"
                         title="Top Destinations By Bytes"
                         [rows]="topDestinationsByBytes"
                         [headers]="['#', 'Destination']"></report-data-table>

      <report-data-table *ngIf="topDestinationsByPackets"
                         title="Top Destinations by Packets"
                         [rows]="topDestinationsByPackets"
                         [headers]="['#', 'Destination']">
      </report-data-table>

    </div>

  </div>

  <div *ngIf="topByBytes" class="panel panel-default">
    <div class="panel-heading">
      <b>Top Flows by Bytes</b>
    </div>
    <eveboxEventTable2 [rows]="topByBytes"
                       [showEventType]="false"
                       [showActiveEvent]="false"></eveboxEventTable2>
  </div>

  <div *ngIf="topFlowsByPackets" class="panel panel-default">
    <div class="panel-heading">
      <b>Top Flows by Packets</b>
    </div>
    <eveboxEventTable2 [rows]="topFlowsByPackets"
                       [showEventType]="false"
                       [showActiveEvent]="false"></eveboxEventTable2>
  </div>

</div>`,
    directives: [
        EveboxMetricsGraphicComponent,
        EveboxReportDataTable,
        EveboxLoadingSpinnerComponent,
        EveboxEventTable2Component,
    ],
    pipes: [
        EveboxHumanizePipe,
    ]

})
export class NetflowReportComponent implements OnInit, OnDestroy {

    private eventsOverTime:any[];

    private topSourcesByBytes:any[];
    private topSourcesByPackets:any[];

    private topDestinationsByBytes:any[];
    private topDestinationsByPackets:any[];

    private topByBytes:any[];
    private topFlowsByPackets:any[];

    private loading:number = 0;

    // A flag that will be set to true if not events to report on were found.
    private noEvents:boolean = false;

    constructor(private ss:EveboxSubscriptionService,
                private reportsService:ReportsService,
                private appService:AppService,
                private toastr:ToastrService,
                private humanize:EveboxHumanizeService) {
    }

    ngOnInit() {

        this.refresh();

        this.ss.subscribe(this, this.appService, (event:AppEvent) => {
            if (event.event == AppEventCode.TIME_RANGE_CHANGED) {
                this.refresh();
            }
        });

    }

    ngOnDestroy() {
        this.ss.unsubscribe(this);
    }

    refresh() {

        this.checkForEvents().then((hasEvents:boolean) => {
            if (hasEvents) {
                this.load();
            }
            else {
                this.noEvents = true;
                this.toastr.warning("No netflow events found.");
            }
        });

    }

    checkForEvents() {

        let query:any = {
            query: {
                filtered: {
                    filter: {
                        and: [
                            // Somewhat limit to eve events of netflow only.
                            {exists: {field: "event_type"}},
                            {term: {event_type: "netflow"}}
                        ]
                    }
                }
            },
            size: 0,
        };

        return this.reportsService.submitQuery(query).then((response:any) => {
            return response.hits.total > 0;
        });

    }

    load() {

        this.loading++;

        let query:any = {
            query: {
                filtered: {
                    filter: {
                        and: [
                            // Somewhat limit to eve events of netflow only.
                            {exists: {field: "event_type"}},
                            {term: {event_type: "netflow"}}
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
                        interval: this.reportsService.guessBestHistogramInterval()
                    }
                },
                topByBytes: {
                    top_hits: {
                        sort: [
                            {"netflow.bytes": {order: "desc"}}
                        ],
                        size: 10,
                    }
                },
                topByPackets: {
                    top_hits: {
                        sort: [
                            {"netflow.pkts": {order: "desc"}}
                        ],
                        size: 10,
                    }
                },
                sourcesByBytes: {
                    terms: {
                        field: "src_ip.raw",
                        order: {
                            "bytes": "desc"
                        },
                    },
                    aggs: {
                        bytes: {
                            sum: {
                                field: "netflow.bytes"
                            }
                        }
                    }
                },
                topDestinationsByBytes: {
                    terms: {
                        field: "dest_ip.raw",
                        order: {
                            "bytes": "desc"
                        },
                    },
                    aggs: {
                        bytes: {
                            sum: {
                                field: "netflow.bytes"
                            }
                        }
                    }
                },
                sourcesByPackets: {
                    terms: {
                        field: "src_ip.raw",
                        order: {
                            "packets": "desc"
                        }
                    },
                    aggs: {
                        packets: {
                            sum: {
                                field: "netflow.pkts"
                            }
                        }
                    }
                },
                topDestinationsByPackets: {
                    terms: {
                        field: "dest_ip.raw",
                        order: {
                            "packets": "desc"
                        },
                    },
                    aggs: {
                        packets: {
                            sum: {
                                field: "netflow.pkts"
                            }
                        }
                    }
                },
            }
        };

        this.reportsService.submitQuery(query).then((response:any) => {

            this.eventsOverTime = response.aggregations.events_over_time.buckets.map((item:any) => {
                return {
                    date: moment(item.key).toDate(),
                    value: item.doc_count
                }
            });

            this.topSourcesByBytes = response.aggregations.sourcesByBytes.buckets.map((bucket:any) => {
                return {
                    key: bucket.key,
                    count: this.humanize.fileSize(bucket.bytes.value),
                };
            });

            this.topDestinationsByBytes = response.aggregations.topDestinationsByBytes.buckets.map((bucket:any) => {
                return {
                    key: bucket.key,
                    count: this.humanize.fileSize(bucket.bytes.value),
                };
            });

            this.topSourcesByPackets = response.aggregations.sourcesByPackets.buckets.map((bucket:any) => {
                return {
                    key: bucket.key,
                    count: bucket.packets.value,
                };
            });

            this.topDestinationsByPackets = response.aggregations.topDestinationsByPackets.buckets.map((bucket:any) => {
                return {
                    key: bucket.key,
                    count: bucket.packets.value,
                };
            });

            this.topByBytes = response.aggregations.topByBytes.hits.hits;
            this.topFlowsByPackets = response.aggregations.topByPackets.hits.hits;

            this.loading--;

        });
    }

}