/*!

      =========================================================
      * Argon Dashboard Chakra - v1.0.0
      =========================================================
      
      * Product Page: https://www.creative-tim.com/product/argon-dashboard-chakra
      * Copyright 2022 Creative Tim (https://www.creative-tim.com)
      * Licensed under MIT (https://github.com/creativetimofficial/argon-dashboard-chakra/blob/master/LICENSE.md)
      
      * Design and Coded by Simmmple & Creative Tim
      
      =========================================================
      
      * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
      
      */
"use strict";(self.webpackChunkmutto_admin_panel=self.webpackChunkmutto_admin_panel||[]).push([[58],{6058:(t,e,n)=>{n.r(e),n.d(e,{Bar:()=>h,Bubble:()=>w,Chart:()=>g,Doughnut:()=>m,Line:()=>b,Pie:()=>y,PolarArea:()=>A,Radar:()=>v,Scatter:()=>k,getDatasetAtEvent:()=>i,getElementAtEvent:()=>d,getElementsAtEvent:()=>f});var r=n(5043),a=n(7304);const s="label";function u(t,e){"function"===typeof t?t(e):t&&(t.current=e)}function c(t,e){t.labels=e}function o(t,e){let n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:s;const r=[];t.datasets=e.map(e=>{const a=t.datasets.find(t=>t[n]===e[n]);return a&&e.data&&!r.includes(a)?(r.push(a),Object.assign(a,e),a):{...e}})}function l(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:s;const n={labels:[],datasets:[]};return c(n,t.labels),o(n,t.datasets,e),n}function i(t,e){return t.getElementsAtEventForMode(e.nativeEvent,"dataset",{intersect:!0},!1)}function d(t,e){return t.getElementsAtEventForMode(e.nativeEvent,"nearest",{intersect:!0},!1)}function f(t,e){return t.getElementsAtEventForMode(e.nativeEvent,"index",{intersect:!0},!1)}function E(t,e){const{height:n=150,width:s=300,redraw:i=!1,datasetIdKey:d,type:f,data:E,options:g,plugins:p=[],fallbackContent:b,updateMode:h,...v}=t,m=(0,r.useRef)(null),A=(0,r.useRef)(null),w=()=>{m.current&&(A.current=new a.t1(m.current,{type:f,data:l(E,d),options:g&&{...g},plugins:p}),u(e,A.current))},y=()=>{u(e,null),A.current&&(A.current.destroy(),A.current=null)};return(0,r.useEffect)(()=>{!i&&A.current&&g&&function(t,e){const n=t.options;n&&e&&Object.assign(n,e)}(A.current,g)},[i,g]),(0,r.useEffect)(()=>{!i&&A.current&&c(A.current.config.data,E.labels)},[i,E.labels]),(0,r.useEffect)(()=>{!i&&A.current&&E.datasets&&o(A.current.config.data,E.datasets,d)},[i,E.datasets]),(0,r.useEffect)(()=>{A.current&&(i?(y(),setTimeout(w)):A.current.update(h))},[i,g,E.labels,E.datasets,h]),(0,r.useEffect)(()=>{A.current&&(y(),setTimeout(w))},[f]),(0,r.useEffect)(()=>(w(),()=>y()),[]),r.createElement("canvas",{ref:m,role:"img",height:n,width:s,...v},b)}const g=(0,r.forwardRef)(E);function p(t,e){return a.t1.register(e),(0,r.forwardRef)((e,n)=>r.createElement(g,{...e,ref:n,type:t}))}const b=p("line",a.ZT),h=p("bar",a.A6),v=p("radar",a.h9),m=p("doughnut",a.ju),A=p("polarArea",a.G5),w=p("bubble",a.Jb),y=p("pie",a.P$),k=p("scatter",a.Pz)}}]);
//# sourceMappingURL=58.9d0146de.chunk.js.map