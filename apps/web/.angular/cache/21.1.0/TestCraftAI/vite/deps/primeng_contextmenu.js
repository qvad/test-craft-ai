import {
  Tooltip,
  TooltipModule
} from "./chunk-R3ZCLH4B.js";
import {
  zindexutils
} from "./chunk-VBERXSOF.js";
import {
  MotionDirective,
  MotionModule
} from "./chunk-7IUBLOJN.js";
import {
  Badge,
  BadgeModule
} from "./chunk-CKVCSZFC.js";
import "./chunk-FJ7IXWTG.js";
import {
  Ripple
} from "./chunk-P4HG34ND.js";
import {
  AngleRightIcon
} from "./chunk-7BCJRHTD.js";
import "./chunk-PYRNDBNK.js";
import {
  BaseComponent,
  Bind,
  BindModule,
  PARENT_INSTANCE
} from "./chunk-L5TEGIUY.js";
import {
  BaseStyle
} from "./chunk-BDY5EMPM.js";
import {
  $t,
  G,
  J,
  J2,
  K,
  M,
  O,
  OverlayService,
  PrimeTemplate,
  SharedModule,
  Ut,
  bt,
  h,
  l,
  m,
  s2 as s,
  s3 as s2,
  ut,
  v,
  z
} from "./chunk-OF5N37LV.js";
import {
  RouterLink,
  RouterModule
} from "./chunk-RJ774NNF.js";
import "./chunk-UDFTPFTI.js";
import "./chunk-63ZAMOE3.js";
import "./chunk-A63YTOZT.js";
import {
  CommonModule,
  NgForOf,
  NgIf,
  NgStyle,
  NgTemplateOutlet,
  isPlatformBrowser
} from "./chunk-B6T7V6GY.js";
import "./chunk-FBNFQZ7C.js";
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  ContentChildren,
  ElementRef,
  EventEmitter,
  Inject,
  Injectable,
  InjectionToken,
  Input,
  NgModule,
  Output,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  numberAttribute,
  setClassMetadata,
  signal,
  ɵɵInheritDefinitionFeature,
  ɵɵProvidersFeature,
  ɵɵadvance,
  ɵɵariaProperty,
  ɵɵattribute,
  ɵɵclassMap,
  ɵɵconditional,
  ɵɵconditionalCreate,
  ɵɵcontentQuery,
  ɵɵdefineComponent,
  ɵɵdefineInjectable,
  ɵɵdefineInjector,
  ɵɵdefineNgModule,
  ɵɵdirectiveInject,
  ɵɵelement,
  ɵɵelementContainerEnd,
  ɵɵelementContainerStart,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵgetInheritedFactory,
  ɵɵlistener,
  ɵɵloadQuery,
  ɵɵnamespaceSVG,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵpureFunction0,
  ɵɵpureFunction1,
  ɵɵpureFunction2,
  ɵɵqueryRefresh,
  ɵɵreference,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵsanitizeHtml,
  ɵɵsanitizeUrl,
  ɵɵstyleMap,
  ɵɵtemplate,
  ɵɵtemplateRefExtractor,
  ɵɵtext,
  ɵɵtextInterpolate1,
  ɵɵviewQuery
} from "./chunk-L2RIJF4M.js";
import "./chunk-HQ5HQZO3.js";
import "./chunk-OUWWR32C.js";
import "./chunk-AICK2LYG.js";
import {
  __spreadProps,
  __spreadValues
} from "./chunk-GOMI4DH3.js";

// ../../node_modules/@primeuix/styles/dist/contextmenu/index.mjs
var style = "\n    .p-contextmenu {\n        background: dt('contextmenu.background');\n        color: dt('contextmenu.color');\n        border: 1px solid dt('contextmenu.border.color');\n        border-radius: dt('contextmenu.border.radius');\n        box-shadow: dt('contextmenu.shadow');\n        min-width: 12.5rem;\n    }\n\n    .p-contextmenu-root-list,\n    .p-contextmenu-submenu {\n        margin: 0;\n        padding: dt('contextmenu.list.padding');\n        list-style: none;\n        outline: 0 none;\n        display: flex;\n        flex-direction: column;\n        gap: dt('contextmenu.list.gap');\n    }\n\n    .p-contextmenu-submenu {\n        position: absolute;\n        display: flex;\n        flex-direction: column;\n        min-width: 100%;\n        z-index: 1;\n        background: dt('contextmenu.background');\n        color: dt('contextmenu.color');\n        border: 1px solid dt('contextmenu.border.color');\n        border-radius: dt('contextmenu.border.radius');\n        box-shadow: dt('contextmenu.shadow');\n    }\n\n    .p-contextmenu-item {\n        position: relative;\n    }\n\n    .p-contextmenu-item-content {\n        transition:\n            background dt('contextmenu.transition.duration'),\n            color dt('contextmenu.transition.duration');\n        border-radius: dt('contextmenu.item.border.radius');\n        color: dt('contextmenu.item.color');\n    }\n\n    .p-contextmenu-item-link {\n        cursor: pointer;\n        display: flex;\n        align-items: center;\n        text-decoration: none;\n        overflow: hidden;\n        position: relative;\n        color: inherit;\n        padding: dt('contextmenu.item.padding');\n        gap: dt('contextmenu.item.gap');\n        user-select: none;\n    }\n\n    .p-contextmenu-item-label {\n        line-height: 1;\n    }\n\n    .p-contextmenu-item-icon {\n        color: dt('contextmenu.item.icon.color');\n    }\n\n    .p-contextmenu-submenu-icon {\n        color: dt('contextmenu.submenu.icon.color');\n        margin-left: auto;\n        font-size: dt('contextmenu.submenu.icon.size');\n        width: dt('contextmenu.submenu.icon.size');\n        height: dt('contextmenu.submenu.icon.size');\n    }\n\n    .p-contextmenu-submenu-icon:dir(rtl) {\n        margin-left: 0;\n        margin-right: auto;\n    }\n\n    .p-contextmenu-item.p-focus > .p-contextmenu-item-content {\n        color: dt('contextmenu.item.focus.color');\n        background: dt('contextmenu.item.focus.background');\n    }\n\n    .p-contextmenu-item.p-focus > .p-contextmenu-item-content .p-contextmenu-item-icon {\n        color: dt('contextmenu.item.icon.focus.color');\n    }\n\n    .p-contextmenu-item.p-focus > .p-contextmenu-item-content .p-contextmenu-submenu-icon {\n        color: dt('contextmenu.submenu.icon.focus.color');\n    }\n\n    .p-contextmenu-item:not(.p-disabled) > .p-contextmenu-item-content:hover {\n        color: dt('contextmenu.item.focus.color');\n        background: dt('contextmenu.item.focus.background');\n    }\n\n    .p-contextmenu-item:not(.p-disabled) > .p-contextmenu-item-content:hover .p-contextmenu-item-icon {\n        color: dt('contextmenu.item.icon.focus.color');\n    }\n\n    .p-contextmenu-item:not(.p-disabled) > .p-contextmenu-item-content:hover .p-contextmenu-submenu-icon {\n        color: dt('contextmenu.submenu.icon.focus.color');\n    }\n\n    .p-contextmenu-item-active > .p-contextmenu-item-content {\n        color: dt('contextmenu.item.active.color');\n        background: dt('contextmenu.item.active.background');\n    }\n\n    .p-contextmenu-item-active > .p-contextmenu-item-content .p-contextmenu-item-icon {\n        color: dt('contextmenu.item.icon.active.color');\n    }\n\n    .p-contextmenu-item-active > .p-contextmenu-item-content .p-contextmenu-submenu-icon {\n        color: dt('contextmenu.submenu.icon.active.color');\n    }\n\n    .p-contextmenu-separator {\n        border-block-start: 1px solid dt('contextmenu.separator.border.color');\n    }\n\n    .p-contextmenu-mobile .p-contextmenu-submenu {\n        position: static;\n        box-shadow: none;\n        border: 0 none;\n        padding-inline-start: dt('tieredmenu.submenu.mobile.indent');\n        padding-inline-end: 0;\n    }\n\n    .p-contextmenu-mobile .p-contextmenu-submenu-icon {\n        transition: transform 0.2s;\n        transform: rotate(90deg);\n    }\n\n    .p-contextmenu-mobile .p-contextmenu-item-active > .p-contextmenu-item-content .p-contextmenu-submenu-icon {\n        transform: rotate(-90deg);\n    }\n";

// ../../node_modules/primeng/fesm2022/primeng-contextmenu.mjs
var _c0 = ["sublist"];
var _c1 = (a0, a1) => ({
  instance: a0,
  processedItem: a1
});
var _c2 = () => ({
  class: "p-contextmenu-submenu-icon"
});
var _c3 = () => ({
  exact: false
});
var _c4 = (a0) => ({
  $implicit: a0
});
function ContextMenuSub_Conditional_0_ng_template_2_li_0_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "li", 8);
  }
  if (rf & 2) {
    const processedItem_r3 = ɵɵnextContext().$implicit;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵstyleMap(ctx_r1.getItemProp(processedItem_r3, "style"));
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("separator"), ctx_r1.getItemProp(processedItem_r3, "styleClass")));
    ɵɵproperty("pBind", ctx_r1._ptm("separator"));
    ɵɵattribute("id", ctx_r1.getItemId(processedItem_r3));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_span_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "span", 19);
  }
  if (rf & 2) {
    const ctx_r4 = ɵɵnextContext(4);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("itemIcon"), ctx_r1.getItemProp(processedItem_r3, "icon"), ctx_r1.getItemProp(processedItem_r3, "iconClass")));
    ɵɵproperty("ngStyle", ctx_r1.getItemProp(processedItem_r3, "iconStyle"))("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "itemIcon"));
    ɵɵattribute("aria-hidden", true)("tabindex", -1);
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_span_2_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementStart(0, "span", 19);
    ɵɵtext(1);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const ctx_r4 = ɵɵnextContext(4);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("itemLabel"), ctx_r1.getItemProp(processedItem_r3, "labelClass")));
    ɵɵproperty("ngStyle", ctx_r1.getItemProp(processedItem_r3, "labelStyle"))("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "itemLabel"));
    ɵɵadvance();
    ɵɵtextInterpolate1(" ", ctx_r1.getItemLabel(processedItem_r3), " ");
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_template_3_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "span", 20);
  }
  if (rf & 2) {
    const ctx_r4 = ɵɵnextContext(4);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("itemLabel"), ctx_r1.getItemProp(processedItem_r3, "labelClass")));
    ɵɵproperty("ngStyle", ctx_r1.getItemProp(processedItem_r3, "labelStyle"))("innerHTML", ctx_r1.getItemLabel(processedItem_r3), ɵɵsanitizeHtml)("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "itemLabel"));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_p_badge_5_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "p-badge", 21);
  }
  if (rf & 2) {
    const processedItem_r3 = ɵɵnextContext(4).$implicit;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.getItemProp(processedItem_r3, "badgeStyleClass"));
    ɵɵproperty("value", ctx_r1.getItemProp(processedItem_r3, "badge"))("unstyled", ctx_r1.unstyled());
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_container_6__svg_svg_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵelement(0, "svg", 24);
  }
  if (rf & 2) {
    const ctx_r4 = ɵɵnextContext(5);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cx("submenuIcon"));
    ɵɵproperty("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "submenuIcon"));
    ɵɵattribute("aria-hidden", true);
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_container_6_2_ng_template_0_Template(rf, ctx) {
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_container_6_2_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵtemplate(0, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_container_6_2_ng_template_0_Template, 0, 0, "ng-template", 25);
  }
  if (rf & 2) {
    ɵɵariaProperty("aria-hidden", true);
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_container_6_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementContainerStart(0);
    ɵɵtemplate(1, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_container_6__svg_svg_1_Template, 1, 4, "svg", 22)(2, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_container_6_2_Template, 1, 1, null, 23);
    ɵɵelementContainerEnd();
  }
  if (rf & 2) {
    const ctx_r1 = ɵɵnextContext(6);
    ɵɵadvance();
    ɵɵproperty("ngIf", !ctx_r1.contextMenu.submenuIconTemplate && !ctx_r1.contextMenu._submenuIconTemplate);
    ɵɵadvance();
    ɵɵproperty("ngTemplateOutlet", ctx_r1.contextMenu.submenuIconTemplate || ctx_r1.contextMenu._submenuIconTemplate)("ngTemplateOutletContext", ɵɵpureFunction0(3, _c2));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementStart(0, "a", 15);
    ɵɵtemplate(1, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_span_1_Template, 1, 6, "span", 16)(2, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_span_2_Template, 2, 5, "span", 17)(3, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_template_3_Template, 1, 5, "ng-template", null, 2, ɵɵtemplateRefExtractor)(5, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_p_badge_5_Template, 1, 4, "p-badge", 18)(6, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_ng_container_6_Template, 3, 4, "ng-container", 11);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const htmlLabel_r7 = ɵɵreference(4);
    const ctx_r4 = ɵɵnextContext(3);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("itemLink"), ctx_r1.getItemProp(processedItem_r3, "linkClass")));
    ɵɵproperty("target", ctx_r1.getItemProp(processedItem_r3, "target"))("ngStyle", ctx_r1.getItemProp(processedItem_r3, "linkStyle"))("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "itemLink"));
    ɵɵattribute("href", ctx_r1.getItemProp(processedItem_r3, "url"), ɵɵsanitizeUrl)("data-automationid", ctx_r1.getItemProp(processedItem_r3, "automationId"))("title", ctx_r1.getItemProp(processedItem_r3, "title"))("tabindex", -1);
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.getItemProp(processedItem_r3, "icon"));
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.getItemProp(processedItem_r3, "escape"))("ngIfElse", htmlLabel_r7);
    ɵɵadvance(3);
    ɵɵproperty("ngIf", ctx_r1.getItemProp(processedItem_r3, "badge"));
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.isItemGroup(processedItem_r3));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_span_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "span", 19);
  }
  if (rf & 2) {
    const ctx_r4 = ɵɵnextContext(4);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("itemIcon"), ctx_r1.getItemProp(processedItem_r3, "icon"), ctx_r1.getItemProp(processedItem_r3, "iconClass")));
    ɵɵproperty("ngStyle", ctx_r1.getItemProp(processedItem_r3, "iconStyle"))("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "itemIcon"));
    ɵɵattribute("aria-hidden", true)("tabindex", -1);
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_span_2_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementStart(0, "span", 19);
    ɵɵtext(1);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const ctx_r4 = ɵɵnextContext(4);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("itemLabel"), ctx_r1.getItemProp(processedItem_r3, "labelClass")));
    ɵɵproperty("ngStyle", ctx_r1.getItemProp(processedItem_r3, "labelStyle"))("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "itemLabel"));
    ɵɵadvance();
    ɵɵtextInterpolate1(" ", ctx_r1.getItemLabel(processedItem_r3), " ");
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_template_3_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "span", 20);
  }
  if (rf & 2) {
    const ctx_r4 = ɵɵnextContext(4);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("itemLabel"), ctx_r1.getItemProp(processedItem_r3, "labelClass")));
    ɵɵproperty("ngStyle", ctx_r1.getItemProp(processedItem_r3, "labelStyle"))("innerHTML", ctx_r1.getItemLabel(processedItem_r3), ɵɵsanitizeHtml)("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "itemLabel"));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_p_badge_5_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "p-badge", 21);
  }
  if (rf & 2) {
    const processedItem_r3 = ɵɵnextContext(4).$implicit;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.getItemProp(processedItem_r3, "badgeStyleClass"));
    ɵɵproperty("value", ctx_r1.getItemProp(processedItem_r3, "badge"))("unstyled", ctx_r1.unstyled());
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_container_6__svg_svg_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵnamespaceSVG();
    ɵɵelement(0, "svg", 24);
  }
  if (rf & 2) {
    const ctx_r4 = ɵɵnextContext(5);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cx("submenuIcon"));
    ɵɵproperty("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "submenuIcon"));
    ɵɵattribute("aria-hidden", true);
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_container_6_2_ng_template_0_Template(rf, ctx) {
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_container_6_2_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵtemplate(0, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_container_6_2_ng_template_0_Template, 0, 0, "ng-template", 25);
  }
  if (rf & 2) {
    ɵɵariaProperty("aria-hidden", true);
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_container_6_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementContainerStart(0);
    ɵɵtemplate(1, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_container_6__svg_svg_1_Template, 1, 4, "svg", 22)(2, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_container_6_2_Template, 1, 1, null, 23);
    ɵɵelementContainerEnd();
  }
  if (rf & 2) {
    const ctx_r1 = ɵɵnextContext(6);
    ɵɵadvance();
    ɵɵproperty("ngIf", !ctx_r1.contextMenu.submenuIconTemplate && !ctx_r1.contextMenu._submenuIconTemplate);
    ɵɵadvance();
    ɵɵproperty("ngTemplateOutlet", ctx_r1.contextMenu.submenuIconTemplate || ctx_r1.contextMenu._submenuIconTemplate)("ngTemplateOutletContext", ɵɵpureFunction0(3, _c2));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementStart(0, "a", 26);
    ɵɵtemplate(1, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_span_1_Template, 1, 6, "span", 16)(2, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_span_2_Template, 2, 5, "span", 17)(3, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_template_3_Template, 1, 5, "ng-template", null, 2, ɵɵtemplateRefExtractor)(5, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_p_badge_5_Template, 1, 4, "p-badge", 18)(6, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_ng_container_6_Template, 3, 4, "ng-container", 11);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const htmlLabel_r8 = ɵɵreference(4);
    const ctx_r4 = ɵɵnextContext(3);
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("itemLink"), ctx_r1.getItemProp(processedItem_r3, "linkClass")));
    ɵɵproperty("routerLink", ctx_r1.getItemProp(processedItem_r3, "routerLink"))("queryParams", ctx_r1.getItemProp(processedItem_r3, "queryParams"))("routerLinkActiveOptions", ctx_r1.getItemProp(processedItem_r3, "routerLinkActiveOptions") || ɵɵpureFunction0(22, _c3))("target", ctx_r1.getItemProp(processedItem_r3, "target"))("ngStyle", ctx_r1.getItemProp(processedItem_r3, "linkStyle"))("fragment", ctx_r1.getItemProp(processedItem_r3, "fragment"))("queryParamsHandling", ctx_r1.getItemProp(processedItem_r3, "queryParamsHandling"))("preserveFragment", ctx_r1.getItemProp(processedItem_r3, "preserveFragment"))("skipLocationChange", ctx_r1.getItemProp(processedItem_r3, "skipLocationChange"))("replaceUrl", ctx_r1.getItemProp(processedItem_r3, "replaceUrl"))("state", ctx_r1.getItemProp(processedItem_r3, "state"))("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "itemLink"));
    ɵɵattribute("data-automationid", ctx_r1.getItemProp(processedItem_r3, "automationId"))("title", ctx_r1.getItemProp(processedItem_r3, "title"))("tabindex", -1);
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.getItemProp(processedItem_r3, "icon"));
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.getItemProp(processedItem_r3, "escape"))("ngIfElse", htmlLabel_r8);
    ɵɵadvance(3);
    ɵɵproperty("ngIf", ctx_r1.getItemProp(processedItem_r3, "badge"));
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.isItemGroup(processedItem_r3));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementContainerStart(0);
    ɵɵtemplate(1, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_1_Template, 7, 14, "a", 13)(2, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_a_2_Template, 7, 23, "a", 14);
    ɵɵelementContainerEnd();
  }
  if (rf & 2) {
    const processedItem_r3 = ɵɵnextContext(2).$implicit;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵadvance();
    ɵɵproperty("ngIf", !ctx_r1.getItemProp(processedItem_r3, "routerLink"));
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.getItemProp(processedItem_r3, "routerLink"));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_4_1_ng_template_0_Template(rf, ctx) {
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_4_1_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵtemplate(0, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_4_1_ng_template_0_Template, 0, 0, "ng-template");
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_4_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelementContainerStart(0);
    ɵɵtemplate(1, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_4_1_Template, 1, 0, null, 23);
    ɵɵelementContainerEnd();
  }
  if (rf & 2) {
    const processedItem_r3 = ɵɵnextContext(2).$implicit;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵadvance();
    ɵɵproperty("ngTemplateOutlet", ctx_r1.itemTemplate)("ngTemplateOutletContext", ɵɵpureFunction1(2, _c4, processedItem_r3.item));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_p_contextmenu_sub_5_Template(rf, ctx) {
  if (rf & 1) {
    const _r9 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "p-contextmenu-sub", 27);
    ɵɵlistener("itemClick", function ContextMenuSub_Conditional_0_ng_template_2_li_1_p_contextmenu_sub_5_Template_p_contextmenu_sub_itemClick_0_listener($event) {
      ɵɵrestoreView(_r9);
      const ctx_r1 = ɵɵnextContext(4);
      return ɵɵresetView(ctx_r1.itemClick.emit($event));
    })("itemMouseEnter", function ContextMenuSub_Conditional_0_ng_template_2_li_1_p_contextmenu_sub_5_Template_p_contextmenu_sub_itemMouseEnter_0_listener($event) {
      ɵɵrestoreView(_r9);
      const ctx_r1 = ɵɵnextContext(4);
      return ɵɵresetView(ctx_r1.onItemMouseEnter($event));
    });
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const processedItem_r3 = ɵɵnextContext(2).$implicit;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵproperty("items", processedItem_r3.items)("itemTemplate", ctx_r1.itemTemplate)("menuId", ctx_r1.menuId)("visible", ctx_r1.isItemActive(processedItem_r3) && ctx_r1.isItemGroup(processedItem_r3))("activeItemPath", ctx_r1.activeItemPath)("focusedItemId", ctx_r1.focusedItemId)("level", ctx_r1.level + 1)("pt", ctx_r1.pt())("motionOptions", ctx_r1.motionOptions)("unstyled", ctx_r1.unstyled());
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_li_1_Template(rf, ctx) {
  if (rf & 1) {
    const _r4 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "li", 9, 1)(2, "div", 10);
    ɵɵlistener("click", function ContextMenuSub_Conditional_0_ng_template_2_li_1_Template_div_click_2_listener($event) {
      ɵɵrestoreView(_r4);
      const processedItem_r3 = ɵɵnextContext().$implicit;
      const ctx_r1 = ɵɵnextContext(2);
      return ɵɵresetView(ctx_r1.onItemClick($event, processedItem_r3));
    })("mouseenter", function ContextMenuSub_Conditional_0_ng_template_2_li_1_Template_div_mouseenter_2_listener($event) {
      ɵɵrestoreView(_r4);
      const processedItem_r3 = ɵɵnextContext().$implicit;
      const ctx_r1 = ɵɵnextContext(2);
      return ɵɵresetView(ctx_r1.onItemMouseEnter({
        $event,
        processedItem: processedItem_r3
      }));
    });
    ɵɵtemplate(3, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_3_Template, 3, 2, "ng-container", 11)(4, ContextMenuSub_Conditional_0_ng_template_2_li_1_ng_container_4_Template, 2, 4, "ng-container", 11);
    ɵɵelementEnd();
    ɵɵtemplate(5, ContextMenuSub_Conditional_0_ng_template_2_li_1_p_contextmenu_sub_5_Template, 1, 10, "p-contextmenu-sub", 12);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const ctx_r4 = ɵɵnextContext();
    const processedItem_r3 = ctx_r4.$implicit;
    const index_r6 = ctx_r4.index;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵstyleMap(ctx_r1.getItemProp(processedItem_r3, "style"));
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("item", ɵɵpureFunction2(24, _c1, ctx_r1, processedItem_r3)), ctx_r1.getItemProp(processedItem_r3, "styleClass")));
    ɵɵproperty("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "item"))("tooltipOptions", ctx_r1.getItemProp(processedItem_r3, "tooltipOptions"))("pTooltipUnstyled", ctx_r1.unstyled());
    ɵɵattribute("id", ctx_r1.getItemId(processedItem_r3))("data-p-highlight", ctx_r1.isItemActive(processedItem_r3))("data-p-focused", ctx_r1.isItemFocused(processedItem_r3))("data-p-disabled", ctx_r1.isItemDisabled(processedItem_r3))("aria-label", ctx_r1.getItemLabel(processedItem_r3))("aria-disabled", ctx_r1.isItemDisabled(processedItem_r3) || void 0)("aria-haspopup", ctx_r1.isItemGroup(processedItem_r3) && !ctx_r1.getItemProp(processedItem_r3, "to") ? "menu" : void 0)("aria-expanded", ctx_r1.isItemGroup(processedItem_r3) ? ctx_r1.isItemActive(processedItem_r3) : void 0)("aria-level", ctx_r1.level + 1)("aria-setsize", ctx_r1.getAriaSetSize())("aria-posinset", ctx_r1.getAriaPosInset(index_r6));
    ɵɵadvance(2);
    ɵɵclassMap(ctx_r1.cx("itemContent"));
    ɵɵproperty("pBind", ctx_r1.getPTOptions(processedItem_r3, index_r6, "itemContent"));
    ɵɵadvance();
    ɵɵproperty("ngIf", !ctx_r1.itemTemplate);
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.itemTemplate);
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.isItemVisible(processedItem_r3) && ctx_r1.isItemGroup(processedItem_r3));
  }
}
function ContextMenuSub_Conditional_0_ng_template_2_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵtemplate(0, ContextMenuSub_Conditional_0_ng_template_2_li_0_Template, 1, 6, "li", 6)(1, ContextMenuSub_Conditional_0_ng_template_2_li_1_Template, 6, 27, "li", 7);
  }
  if (rf & 2) {
    const processedItem_r3 = ctx.$implicit;
    const ctx_r1 = ɵɵnextContext(2);
    ɵɵproperty("ngIf", ctx_r1.isItemVisible(processedItem_r3) && ctx_r1.getItemProp(processedItem_r3, "separator"));
    ɵɵadvance();
    ɵɵproperty("ngIf", ctx_r1.isItemVisible(processedItem_r3) && !ctx_r1.getItemProp(processedItem_r3, "separator"));
  }
}
function ContextMenuSub_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "ul", 4, 0);
    ɵɵlistener("keydown", function ContextMenuSub_Conditional_0_Template_ul_keydown_0_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.menuKeydown.emit($event));
    })("focus", function ContextMenuSub_Conditional_0_Template_ul_focus_0_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.menuFocus.emit($event));
    })("blur", function ContextMenuSub_Conditional_0_Template_ul_blur_0_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.menuBlur.emit($event));
    })("pMotionOnBeforeEnter", function ContextMenuSub_Conditional_0_Template_ul_pMotionOnBeforeEnter_0_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onBeforeEnter($event));
    })("pMotionOnAfterLeave", function ContextMenuSub_Conditional_0_Template_ul_pMotionOnAfterLeave_0_listener() {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onAfterLeave());
    });
    ɵɵtemplate(2, ContextMenuSub_Conditional_0_ng_template_2_Template, 2, 2, "ng-template", 5);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = ɵɵnextContext();
    ɵɵclassMap(ctx_r1.root ? ctx_r1.cx("rootList") : ctx_r1.cx("submenu"));
    ɵɵproperty("pBind", ctx_r1._ptm(ctx_r1.root ? "rootList" : "submenu"))("tabindex", ctx_r1.tabindex)("pMotion", ctx_r1.root ? true : ctx_r1.visible)("pMotionAppear", true)("pMotionName", "p-anchored-overlay")("pMotionOptions", ctx_r1.motionOptions);
    ɵɵattribute("id", ctx_r1.menuId + "_list")("aria-label", ctx_r1.ariaLabel)("aria-labelledBy", ctx_r1.ariaLabelledBy)("aria-activedescendant", ctx_r1.focusedItemId)("aria-orientation", "vertical");
    ɵɵadvance(2);
    ɵɵproperty("ngForOf", ctx_r1.items);
  }
}
var _c5 = ["item"];
var _c6 = ["submenuicon"];
var _c7 = ["rootmenu"];
function ContextMenu_Conditional_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "div", 3, 0);
    ɵɵlistener("pMotionOnBeforeEnter", function ContextMenu_Conditional_0_Template_div_pMotionOnBeforeEnter_0_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onBeforeEnter($event));
    })("pMotionOnAfterEnter", function ContextMenu_Conditional_0_Template_div_pMotionOnAfterEnter_0_listener() {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onAfterEnter());
    })("pMotionOnAfterLeave", function ContextMenu_Conditional_0_Template_div_pMotionOnAfterLeave_0_listener() {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onAfterLeave());
    });
    ɵɵelementStart(2, "p-contextmenu-sub", 4, 1);
    ɵɵlistener("itemClick", function ContextMenu_Conditional_0_Template_p_contextmenu_sub_itemClick_2_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onItemClick($event));
    })("menuFocus", function ContextMenu_Conditional_0_Template_p_contextmenu_sub_menuFocus_2_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onMenuFocus($event));
    })("menuBlur", function ContextMenu_Conditional_0_Template_p_contextmenu_sub_menuBlur_2_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onMenuBlur($event));
    })("menuKeydown", function ContextMenu_Conditional_0_Template_p_contextmenu_sub_menuKeydown_2_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onKeyDown($event));
    })("itemMouseEnter", function ContextMenu_Conditional_0_Template_p_contextmenu_sub_itemMouseEnter_2_listener($event) {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.onItemMouseEnter($event));
    });
    ɵɵelementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = ɵɵnextContext();
    ɵɵstyleMap(ctx_r1.sx("root"));
    ɵɵclassMap(ctx_r1.cn(ctx_r1.cx("root"), ctx_r1.styleClass));
    ɵɵproperty("ngStyle", ctx_r1.style)("pBind", ctx_r1.ptm("root"))("pMotion", ctx_r1.visible())("pMotionName", "p-anchored-overlay")("pMotionAppear", true)("pMotionOptions", ctx_r1.computedMotionOptions());
    ɵɵattribute("id", ctx_r1.id);
    ɵɵadvance(2);
    ɵɵproperty("root", true)("items", ctx_r1.processedItems)("itemTemplate", ctx_r1.itemTemplate || ctx_r1._itemTemplate)("menuId", ctx_r1.id)("ariaLabel", ctx_r1.ariaLabel)("ariaLabelledBy", ctx_r1.ariaLabelledBy)("baseZIndex", ctx_r1.baseZIndex)("autoZIndex", ctx_r1.autoZIndex)("visible", ctx_r1.submenuVisible())("focusedItemId", ctx_r1.focused ? ctx_r1.focusedItemId : void 0)("activeItemPath", ctx_r1.activeItemPath())("pt", ctx_r1.pt())("unstyled", ctx_r1.unstyled())("motionOptions", ctx_r1.computedMotionOptions());
  }
}
var inlineStyles = {
  root: {
    position: "absolute"
  }
};
var classes = {
  root: () => ["p-contextmenu p-component"],
  rootList: "p-contextmenu-root-list",
  item: ({
    instance,
    processedItem
  }) => ["p-contextmenu-item", {
    "p-contextmenu-item-active": instance.isItemActive(processedItem),
    "p-focus": instance.isItemFocused(processedItem),
    "p-disabled": instance.isItemDisabled(processedItem),
    "p-contextmenu-mobile": instance.queryMatches
  }],
  itemContent: "p-contextmenu-item-content",
  itemLink: "p-contextmenu-item-link",
  itemIcon: "p-contextmenu-item-icon",
  itemLabel: "p-contextmenu-item-label",
  submenuIcon: "p-contextmenu-submenu-icon",
  submenu: "p-contextmenu-submenu",
  separator: "p-contextmenu-separator"
};
var ContextMenuStyle = class _ContextMenuStyle extends BaseStyle {
  name = "contextmenu";
  style = style;
  classes = classes;
  inlineStyles = inlineStyles;
  static ɵfac = /* @__PURE__ */ (() => {
    let ɵContextMenuStyle_BaseFactory;
    return function ContextMenuStyle_Factory(__ngFactoryType__) {
      return (ɵContextMenuStyle_BaseFactory || (ɵContextMenuStyle_BaseFactory = ɵɵgetInheritedFactory(_ContextMenuStyle)))(__ngFactoryType__ || _ContextMenuStyle);
    };
  })();
  static ɵprov = ɵɵdefineInjectable({
    token: _ContextMenuStyle,
    factory: _ContextMenuStyle.ɵfac
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ContextMenuStyle, [{
    type: Injectable
  }], null, null);
})();
var ContextMenuClasses;
(function(ContextMenuClasses2) {
  ContextMenuClasses2["root"] = "p-contextmenu";
  ContextMenuClasses2["rootList"] = "p-contextmenu-root-list";
  ContextMenuClasses2["item"] = "p-contextmenu-item";
  ContextMenuClasses2["itemContent"] = "p-contextmenu-item-content";
  ContextMenuClasses2["itemLink"] = "p-contextmenu-item-link";
  ContextMenuClasses2["itemIcon"] = "p-contextmenu-item-icon";
  ContextMenuClasses2["itemLabel"] = "p-contextmenu-item-label";
  ContextMenuClasses2["submenuIcon"] = "p-contextmenu-submenu-icon";
  ContextMenuClasses2["submenu"] = "p-contextmenu-submenu";
  ContextMenuClasses2["separator"] = "p-contextmenu-separator";
})(ContextMenuClasses || (ContextMenuClasses = {}));
var CONTEXTMENU_INSTANCE = new InjectionToken("CONTEXTMENU_INSTANCE");
var CONTEXTMENUSUB_INSTANCE = new InjectionToken("CONTEXTMENUSUB_INSTANCE");
var ContextMenuSub = class _ContextMenuSub extends BaseComponent {
  el;
  renderer;
  contextMenu;
  get visible() {
    return this._visible;
  }
  set visible(value) {
    this._visible = value;
    if (this._visible || this.root) {
      this.render.set(true);
    }
  }
  items;
  itemTemplate;
  root = false;
  autoZIndex = true;
  baseZIndex = 0;
  popup;
  menuId;
  ariaLabel;
  ariaLabelledBy;
  level = 0;
  focusedItemId;
  activeItemPath;
  motionOptions;
  tabindex = 0;
  itemClick = new EventEmitter();
  itemMouseEnter = new EventEmitter();
  menuFocus = new EventEmitter();
  menuBlur = new EventEmitter();
  menuKeydown = new EventEmitter();
  sublistViewChild;
  render = signal(false, ...ngDevMode ? [{
    debugName: "render"
  }] : []);
  hostName = "ContextMenu";
  _componentStyle = inject(ContextMenuStyle);
  $pcContextMenu = inject(CONTEXTMENU_INSTANCE, {
    optional: true,
    skipSelf: true
  }) ?? void 0;
  $pcContextMenuSub = inject(CONTEXTMENUSUB_INSTANCE, {
    optional: true,
    skipSelf: true
  }) ?? void 0;
  _visible = false;
  constructor(el, renderer, contextMenu) {
    super();
    this.el = el;
    this.renderer = renderer;
    this.contextMenu = contextMenu;
    this.contextMenu.handleSubmenuAfterLeave = () => {
      if (this.root) {
        this.onAfterLeave();
      }
    };
  }
  getItemProp(processedItem, name, params = null) {
    return processedItem && processedItem.item ? m(processedItem.item[name], params) : void 0;
  }
  getItemId(processedItem) {
    return processedItem.item && processedItem.item?.id ? processedItem.item.id : `${this.menuId}_${processedItem.key}`;
  }
  getItemKey(processedItem) {
    return this.getItemId(processedItem);
  }
  getItemLabel(processedItem) {
    return this.getItemProp(processedItem, "label");
  }
  getAriaSetSize() {
    return this.items.filter((processedItem) => this.isItemVisible(processedItem) && !this.getItemProp(processedItem, "separator")).length;
  }
  getAriaPosInset(index) {
    return index - this.items.slice(0, index).filter((processedItem) => this.isItemVisible(processedItem) && this.getItemProp(processedItem, "separator")).length + 1;
  }
  isItemVisible(processedItem) {
    return this.getItemProp(processedItem, "visible") !== false;
  }
  isItemActive(processedItem) {
    if (this.activeItemPath) {
      return this.activeItemPath.some((path) => path.key === processedItem.key);
    }
  }
  isItemDisabled(processedItem) {
    return this.getItemProp(processedItem, "disabled");
  }
  isItemFocused(processedItem) {
    return this.focusedItemId === this.getItemId(processedItem);
  }
  isItemGroup(processedItem) {
    return s(processedItem.items);
  }
  onItemMouseEnter(param) {
    const {
      event,
      processedItem
    } = param;
    this.itemMouseEnter.emit({
      originalEvent: event,
      processedItem
    });
  }
  onItemClick(event, processedItem) {
    this.getItemProp(processedItem, "command", {
      originalEvent: event,
      item: processedItem.item
    });
    this.itemClick.emit({
      originalEvent: event,
      processedItem,
      isFocus: true
    });
  }
  onBeforeEnter(event) {
    this.position(event.element);
  }
  onAfterLeave() {
    this.render.set(false);
  }
  // TODO: will be removed later. Helper method to get PT from parent ContextMenu if available, otherwise use own PT
  _ptm(section, options) {
    return this.$pcContextMenu ? this.$pcContextMenu.ptm(section, options) : this.ptm(section, options);
  }
  getPTOptions(processedItem, index, key) {
    return this._ptm(key, {
      context: {
        item: processedItem.item,
        index,
        active: this.isItemActive(processedItem),
        focused: this.isItemFocused(processedItem),
        disabled: this.isItemDisabled(processedItem)
      }
    });
  }
  position(sublist) {
    const parentItem = sublist.parentElement.parentElement;
    const containerOffset = K(sublist.parentElement.parentElement);
    const viewport = h();
    const sublistWidth = sublist.offsetParent ? sublist.offsetWidth : J(sublist);
    const itemOuterWidth = v(parentItem.children[0]);
    sublist.style.top = "0px";
    if (parseInt(containerOffset.left, 10) + itemOuterWidth + sublistWidth > viewport.width - O()) {
      sublist.style.left = -1 * sublistWidth + "px";
    } else {
      sublist.style.left = itemOuterWidth + "px";
    }
  }
  static ɵfac = function ContextMenuSub_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ContextMenuSub)(ɵɵdirectiveInject(ElementRef), ɵɵdirectiveInject(Renderer2), ɵɵdirectiveInject(forwardRef(() => ContextMenu)));
  };
  static ɵcmp = ɵɵdefineComponent({
    type: _ContextMenuSub,
    selectors: [["p-contextMenuSub"], ["p-contextmenu-sub"]],
    viewQuery: function ContextMenuSub_Query(rf, ctx) {
      if (rf & 1) {
        ɵɵviewQuery(_c0, 5);
      }
      if (rf & 2) {
        let _t;
        ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx.sublistViewChild = _t.first);
      }
    },
    inputs: {
      visible: "visible",
      items: "items",
      itemTemplate: "itemTemplate",
      root: [2, "root", "root", booleanAttribute],
      autoZIndex: [2, "autoZIndex", "autoZIndex", booleanAttribute],
      baseZIndex: [2, "baseZIndex", "baseZIndex", numberAttribute],
      popup: [2, "popup", "popup", booleanAttribute],
      menuId: "menuId",
      ariaLabel: "ariaLabel",
      ariaLabelledBy: "ariaLabelledBy",
      level: [2, "level", "level", numberAttribute],
      focusedItemId: "focusedItemId",
      activeItemPath: "activeItemPath",
      motionOptions: "motionOptions",
      tabindex: [2, "tabindex", "tabindex", numberAttribute]
    },
    outputs: {
      itemClick: "itemClick",
      itemMouseEnter: "itemMouseEnter",
      menuFocus: "menuFocus",
      menuBlur: "menuBlur",
      menuKeydown: "menuKeydown"
    },
    features: [ɵɵProvidersFeature([ContextMenuStyle, {
      provide: CONTEXTMENUSUB_INSTANCE,
      useExisting: _ContextMenuSub
    }, {
      provide: PARENT_INSTANCE,
      useExisting: _ContextMenuSub
    }]), ɵɵInheritDefinitionFeature],
    decls: 1,
    vars: 1,
    consts: [["sublist", ""], ["listItem", ""], ["htmlLabel", ""], ["role", "menu", 3, "class", "pBind", "tabindex", "pMotion", "pMotionAppear", "pMotionName", "pMotionOptions"], ["role", "menu", 3, "keydown", "focus", "blur", "pMotionOnBeforeEnter", "pMotionOnAfterLeave", "pBind", "tabindex", "pMotion", "pMotionAppear", "pMotionName", "pMotionOptions"], ["ngFor", "", 3, "ngForOf"], ["role", "separator", 3, "style", "class", "pBind", 4, "ngIf"], ["role", "menuitem", "pTooltip", "", 3, "style", "class", "pBind", "tooltipOptions", "pTooltipUnstyled", 4, "ngIf"], ["role", "separator", 3, "pBind"], ["role", "menuitem", "pTooltip", "", 3, "pBind", "tooltipOptions", "pTooltipUnstyled"], [3, "click", "mouseenter", "pBind"], [4, "ngIf"], [3, "items", "itemTemplate", "menuId", "visible", "activeItemPath", "focusedItemId", "level", "pt", "motionOptions", "unstyled", "itemClick", "itemMouseEnter", 4, "ngIf"], ["pRipple", "", 3, "target", "class", "ngStyle", "pBind", 4, "ngIf"], ["pRipple", "", 3, "routerLink", "queryParams", "routerLinkActiveOptions", "target", "class", "ngStyle", "fragment", "queryParamsHandling", "preserveFragment", "skipLocationChange", "replaceUrl", "state", "pBind", 4, "ngIf"], ["pRipple", "", 3, "target", "ngStyle", "pBind"], [3, "class", "ngStyle", "pBind", 4, "ngIf"], [3, "class", "ngStyle", "pBind", 4, "ngIf", "ngIfElse"], [3, "class", "value", "unstyled", 4, "ngIf"], [3, "ngStyle", "pBind"], [3, "ngStyle", "innerHTML", "pBind"], [3, "value", "unstyled"], ["data-p-icon", "angle-right", 3, "class", "pBind", 4, "ngIf"], [4, "ngTemplateOutlet", "ngTemplateOutletContext"], ["data-p-icon", "angle-right", 3, "pBind"], [3, "aria-hidden"], ["pRipple", "", 3, "routerLink", "queryParams", "routerLinkActiveOptions", "target", "ngStyle", "fragment", "queryParamsHandling", "preserveFragment", "skipLocationChange", "replaceUrl", "state", "pBind"], [3, "itemClick", "itemMouseEnter", "items", "itemTemplate", "menuId", "visible", "activeItemPath", "focusedItemId", "level", "pt", "motionOptions", "unstyled"]],
    template: function ContextMenuSub_Template(rf, ctx) {
      if (rf & 1) {
        ɵɵconditionalCreate(0, ContextMenuSub_Conditional_0_Template, 3, 14, "ul", 3);
      }
      if (rf & 2) {
        ɵɵconditional(ctx.render() ? 0 : -1);
      }
    },
    dependencies: [_ContextMenuSub, CommonModule, NgForOf, NgIf, NgTemplateOutlet, NgStyle, RouterModule, RouterLink, Ripple, TooltipModule, Tooltip, Bind, AngleRightIcon, BadgeModule, Badge, SharedModule, BindModule, MotionModule, MotionDirective],
    encapsulation: 2
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ContextMenuSub, [{
    type: Component,
    args: [{
      selector: "p-contextMenuSub, p-contextmenu-sub",
      standalone: true,
      imports: [CommonModule, RouterModule, Ripple, TooltipModule, AngleRightIcon, BadgeModule, SharedModule, BindModule, MotionModule],
      template: `
        @if (render()) {
            <ul
                #sublist
                role="menu"
                [class]="root ? cx('rootList') : cx('submenu')"
                [pBind]="_ptm(root ? 'rootList' : 'submenu')"
                [attr.id]="menuId + '_list'"
                [tabindex]="tabindex"
                [attr.aria-label]="ariaLabel"
                [attr.aria-labelledBy]="ariaLabelledBy"
                [attr.aria-activedescendant]="focusedItemId"
                [attr.aria-orientation]="'vertical'"
                (keydown)="menuKeydown.emit($event)"
                (focus)="menuFocus.emit($event)"
                (blur)="menuBlur.emit($event)"
                [pMotion]="root ? true : visible"
                [pMotionAppear]="true"
                [pMotionName]="'p-anchored-overlay'"
                [pMotionOptions]="motionOptions"
                (pMotionOnBeforeEnter)="onBeforeEnter($event)"
                (pMotionOnAfterLeave)="onAfterLeave()"
            >
                <ng-template ngFor let-processedItem [ngForOf]="items" let-index="index">
                    <li
                        *ngIf="isItemVisible(processedItem) && getItemProp(processedItem, 'separator')"
                        [attr.id]="getItemId(processedItem)"
                        [style]="getItemProp(processedItem, 'style')"
                        [class]="cn(cx('separator'), getItemProp(processedItem, 'styleClass'))"
                        role="separator"
                        [pBind]="_ptm('separator')"
                    ></li>
                    <li
                        #listItem
                        *ngIf="isItemVisible(processedItem) && !getItemProp(processedItem, 'separator')"
                        role="menuitem"
                        [attr.id]="getItemId(processedItem)"
                        [attr.data-p-highlight]="isItemActive(processedItem)"
                        [attr.data-p-focused]="isItemFocused(processedItem)"
                        [attr.data-p-disabled]="isItemDisabled(processedItem)"
                        [attr.aria-label]="getItemLabel(processedItem)"
                        [attr.aria-disabled]="isItemDisabled(processedItem) || undefined"
                        [attr.aria-haspopup]="isItemGroup(processedItem) && !getItemProp(processedItem, 'to') ? 'menu' : undefined"
                        [attr.aria-expanded]="isItemGroup(processedItem) ? isItemActive(processedItem) : undefined"
                        [attr.aria-level]="level + 1"
                        [attr.aria-setsize]="getAriaSetSize()"
                        [attr.aria-posinset]="getAriaPosInset(index)"
                        [style]="getItemProp(processedItem, 'style')"
                        [class]="cn(cx('item', { instance: this, processedItem }), getItemProp(processedItem, 'styleClass'))"
                        [pBind]="getPTOptions(processedItem, index, 'item')"
                        pTooltip
                        [tooltipOptions]="getItemProp(processedItem, 'tooltipOptions')"
                        [pTooltipUnstyled]="unstyled()"
                    >
                        <div [class]="cx('itemContent')" [pBind]="getPTOptions(processedItem, index, 'itemContent')" (click)="onItemClick($event, processedItem)" (mouseenter)="onItemMouseEnter({ $event, processedItem })">
                            <ng-container *ngIf="!itemTemplate">
                                <a
                                    *ngIf="!getItemProp(processedItem, 'routerLink')"
                                    [attr.href]="getItemProp(processedItem, 'url')"
                                    [attr.data-automationid]="getItemProp(processedItem, 'automationId')"
                                    [attr.title]="getItemProp(processedItem, 'title')"
                                    [target]="getItemProp(processedItem, 'target')"
                                    [class]="cn(cx('itemLink'), getItemProp(processedItem, 'linkClass'))"
                                    [ngStyle]="getItemProp(processedItem, 'linkStyle')"
                                    [attr.tabindex]="-1"
                                    [pBind]="getPTOptions(processedItem, index, 'itemLink')"
                                    pRipple
                                >
                                    <span
                                        *ngIf="getItemProp(processedItem, 'icon')"
                                        [class]="cn(cx('itemIcon'), getItemProp(processedItem, 'icon'), getItemProp(processedItem, 'iconClass'))"
                                        [ngStyle]="getItemProp(processedItem, 'iconStyle')"
                                        [pBind]="getPTOptions(processedItem, index, 'itemIcon')"
                                        [attr.aria-hidden]="true"
                                        [attr.tabindex]="-1"
                                    >
                                    </span>
                                    <span
                                        *ngIf="getItemProp(processedItem, 'escape'); else htmlLabel"
                                        [class]="cn(cx('itemLabel'), getItemProp(processedItem, 'labelClass'))"
                                        [ngStyle]="getItemProp(processedItem, 'labelStyle')"
                                        [pBind]="getPTOptions(processedItem, index, 'itemLabel')"
                                    >
                                        {{ getItemLabel(processedItem) }}
                                    </span>
                                    <ng-template #htmlLabel>
                                        <span
                                            [class]="cn(cx('itemLabel'), getItemProp(processedItem, 'labelClass'))"
                                            [ngStyle]="getItemProp(processedItem, 'labelStyle')"
                                            [innerHTML]="getItemLabel(processedItem)"
                                            [pBind]="getPTOptions(processedItem, index, 'itemLabel')"
                                        ></span>
                                    </ng-template>
                                    <p-badge *ngIf="getItemProp(processedItem, 'badge')" [class]="getItemProp(processedItem, 'badgeStyleClass')" [value]="getItemProp(processedItem, 'badge')" [unstyled]="unstyled()" />
                                    <ng-container *ngIf="isItemGroup(processedItem)">
                                        <svg
                                            data-p-icon="angle-right"
                                            *ngIf="!contextMenu.submenuIconTemplate && !contextMenu._submenuIconTemplate"
                                            [class]="cx('submenuIcon')"
                                            [pBind]="getPTOptions(processedItem, index, 'submenuIcon')"
                                            [attr.aria-hidden]="true"
                                        />
                                        <ng-template *ngTemplateOutlet="contextMenu.submenuIconTemplate || contextMenu._submenuIconTemplate; context: { class: 'p-contextmenu-submenu-icon' }" [attr.aria-hidden]="true"></ng-template>
                                    </ng-container>
                                </a>
                                <a
                                    *ngIf="getItemProp(processedItem, 'routerLink')"
                                    [routerLink]="getItemProp(processedItem, 'routerLink')"
                                    [attr.data-automationid]="getItemProp(processedItem, 'automationId')"
                                    [attr.title]="getItemProp(processedItem, 'title')"
                                    [attr.tabindex]="-1"
                                    [queryParams]="getItemProp(processedItem, 'queryParams')"
                                    [routerLinkActiveOptions]="getItemProp(processedItem, 'routerLinkActiveOptions') || { exact: false }"
                                    [target]="getItemProp(processedItem, 'target')"
                                    [class]="cn(cx('itemLink'), getItemProp(processedItem, 'linkClass'))"
                                    [ngStyle]="getItemProp(processedItem, 'linkStyle')"
                                    [fragment]="getItemProp(processedItem, 'fragment')"
                                    [queryParamsHandling]="getItemProp(processedItem, 'queryParamsHandling')"
                                    [preserveFragment]="getItemProp(processedItem, 'preserveFragment')"
                                    [skipLocationChange]="getItemProp(processedItem, 'skipLocationChange')"
                                    [replaceUrl]="getItemProp(processedItem, 'replaceUrl')"
                                    [state]="getItemProp(processedItem, 'state')"
                                    [pBind]="getPTOptions(processedItem, index, 'itemLink')"
                                    pRipple
                                >
                                    <span
                                        *ngIf="getItemProp(processedItem, 'icon')"
                                        [class]="cn(cx('itemIcon'), getItemProp(processedItem, 'icon'), getItemProp(processedItem, 'iconClass'))"
                                        [ngStyle]="getItemProp(processedItem, 'iconStyle')"
                                        [pBind]="getPTOptions(processedItem, index, 'itemIcon')"
                                        [attr.aria-hidden]="true"
                                        [attr.tabindex]="-1"
                                    >
                                    </span>
                                    <span
                                        *ngIf="getItemProp(processedItem, 'escape'); else htmlLabel"
                                        [class]="cn(cx('itemLabel'), getItemProp(processedItem, 'labelClass'))"
                                        [ngStyle]="getItemProp(processedItem, 'labelStyle')"
                                        [pBind]="getPTOptions(processedItem, index, 'itemLabel')"
                                    >
                                        {{ getItemLabel(processedItem) }}
                                    </span>
                                    <ng-template #htmlLabel>
                                        <span
                                            [class]="cn(cx('itemLabel'), getItemProp(processedItem, 'labelClass'))"
                                            [ngStyle]="getItemProp(processedItem, 'labelStyle')"
                                            [innerHTML]="getItemLabel(processedItem)"
                                            [pBind]="getPTOptions(processedItem, index, 'itemLabel')"
                                        ></span>
                                    </ng-template>
                                    <p-badge *ngIf="getItemProp(processedItem, 'badge')" [class]="getItemProp(processedItem, 'badgeStyleClass')" [value]="getItemProp(processedItem, 'badge')" [unstyled]="unstyled()" />
                                    <ng-container *ngIf="isItemGroup(processedItem)">
                                        <svg
                                            data-p-icon="angle-right"
                                            *ngIf="!contextMenu.submenuIconTemplate && !contextMenu._submenuIconTemplate"
                                            [class]="cx('submenuIcon')"
                                            [pBind]="getPTOptions(processedItem, index, 'submenuIcon')"
                                            [attr.aria-hidden]="true"
                                        />
                                        <ng-template *ngTemplateOutlet="contextMenu.submenuIconTemplate || contextMenu._submenuIconTemplate; context: { class: 'p-contextmenu-submenu-icon' }" [attr.aria-hidden]="true"></ng-template>
                                    </ng-container>
                                </a>
                            </ng-container>
                            <ng-container *ngIf="itemTemplate">
                                <ng-template *ngTemplateOutlet="itemTemplate; context: { $implicit: processedItem.item }"></ng-template>
                            </ng-container>
                        </div>

                        <p-contextmenu-sub
                            *ngIf="isItemVisible(processedItem) && isItemGroup(processedItem)"
                            [items]="processedItem.items"
                            [itemTemplate]="itemTemplate"
                            [menuId]="menuId"
                            [visible]="isItemActive(processedItem) && isItemGroup(processedItem)"
                            [activeItemPath]="activeItemPath"
                            [focusedItemId]="focusedItemId"
                            [level]="level + 1"
                            (itemClick)="itemClick.emit($event)"
                            (itemMouseEnter)="onItemMouseEnter($event)"
                            [pt]="pt()"
                            [motionOptions]="motionOptions"
                            [unstyled]="unstyled()"
                        />
                    </li>
                </ng-template>
            </ul>
        }
    `,
      encapsulation: ViewEncapsulation.None,
      providers: [ContextMenuStyle, {
        provide: CONTEXTMENUSUB_INSTANCE,
        useExisting: ContextMenuSub
      }, {
        provide: PARENT_INSTANCE,
        useExisting: ContextMenuSub
      }]
    }]
  }], () => [{
    type: ElementRef
  }, {
    type: Renderer2
  }, {
    type: ContextMenu,
    decorators: [{
      type: Inject,
      args: [forwardRef(() => ContextMenu)]
    }]
  }], {
    visible: [{
      type: Input
    }],
    items: [{
      type: Input
    }],
    itemTemplate: [{
      type: Input
    }],
    root: [{
      type: Input,
      args: [{
        transform: booleanAttribute
      }]
    }],
    autoZIndex: [{
      type: Input,
      args: [{
        transform: booleanAttribute
      }]
    }],
    baseZIndex: [{
      type: Input,
      args: [{
        transform: numberAttribute
      }]
    }],
    popup: [{
      type: Input,
      args: [{
        transform: booleanAttribute
      }]
    }],
    menuId: [{
      type: Input
    }],
    ariaLabel: [{
      type: Input
    }],
    ariaLabelledBy: [{
      type: Input
    }],
    level: [{
      type: Input,
      args: [{
        transform: numberAttribute
      }]
    }],
    focusedItemId: [{
      type: Input
    }],
    activeItemPath: [{
      type: Input
    }],
    motionOptions: [{
      type: Input
    }],
    tabindex: [{
      type: Input,
      args: [{
        transform: numberAttribute
      }]
    }],
    itemClick: [{
      type: Output
    }],
    itemMouseEnter: [{
      type: Output
    }],
    menuFocus: [{
      type: Output
    }],
    menuBlur: [{
      type: Output
    }],
    menuKeydown: [{
      type: Output
    }],
    sublistViewChild: [{
      type: ViewChild,
      args: ["sublist"]
    }]
  });
})();
var ContextMenu = class _ContextMenu extends BaseComponent {
  overlayService;
  /**
   * An array of menuitems.
   * @group Props
   */
  set model(value) {
    this._model = value;
    this._processedItems = this.createProcessedItems(this._model || []);
  }
  get model() {
    return this._model;
  }
  /**
   * Event for which the menu must be displayed.
   * @group Props
   */
  triggerEvent = "contextmenu";
  /**
   * Local template variable name of the element to attach the context menu.
   * @group Props
   */
  target;
  /**
   * Attaches the menu to document instead of a particular item.
   * @group Props
   */
  global;
  /**
   * Inline style of the component.
   * @group Props
   */
  style;
  /**
   * Style class of the component.
   * @group Props
   */
  styleClass;
  /**
   * Whether to automatically manage layering.
   * @group Props
   */
  autoZIndex = true;
  /**
   * Base zIndex value to use in layering.
   * @group Props
   */
  baseZIndex = 0;
  /**
   * Current id state as a string.
   * @group Props
   */
  id;
  /**
   * The breakpoint to define the maximum width boundary.
   * @group Props
   */
  breakpoint = "960px";
  /**
   * Defines a string value that labels an interactive element.
   * @group Props
   */
  ariaLabel;
  /**
   * Identifier of the underlying input element.
   * @group Props
   */
  ariaLabelledBy;
  /**
   * Press delay in touch devices as miliseconds.
   * @group Props
   */
  pressDelay = 500;
  /**
   * Target element to attach the overlay, valid values are "body" or a local ng-template variable of another element (note: use binding with brackets for template variables, e.g. [appendTo]="mydiv" for a div element having #mydiv as variable name).
   * @defaultValue 'self'
   * @group Props
   */
  appendTo = input(void 0, ...ngDevMode ? [{
    debugName: "appendTo"
  }] : []);
  /**
   * The motion options.
   * @group Props
   */
  motionOptions = input(void 0, ...ngDevMode ? [{
    debugName: "motionOptions"
  }] : []);
  computedMotionOptions = computed(() => {
    return __spreadValues(__spreadValues({}, this.ptm("motion")), this.motionOptions());
  }, ...ngDevMode ? [{
    debugName: "computedMotionOptions"
  }] : []);
  /**
   * Callback to invoke when overlay menu is shown.
   * @group Emits
   */
  onShow = new EventEmitter();
  /**
   * Callback to invoke when overlay menu is hidden.
   * @group Emits
   */
  onHide = new EventEmitter();
  rootmenu;
  container;
  handleSubmenuAfterLeave = null;
  outsideClickListener;
  resizeListener;
  triggerEventListener;
  documentClickListener;
  documentTriggerListener;
  touchEndListener;
  pageX;
  pageY;
  visible = signal(false, ...ngDevMode ? [{
    debugName: "visible"
  }] : []);
  render = signal(false, ...ngDevMode ? [{
    debugName: "render"
  }] : []);
  focused = false;
  activeItemPath = signal([], ...ngDevMode ? [{
    debugName: "activeItemPath"
  }] : []);
  focusedItemInfo = signal({
    index: -1,
    level: 0,
    parentKey: "",
    item: null
  }, ...ngDevMode ? [{
    debugName: "focusedItemInfo"
  }] : []);
  submenuVisible = signal(false, ...ngDevMode ? [{
    debugName: "submenuVisible"
  }] : []);
  $appendTo = computed(() => this.appendTo() || this.config.overlayAppendTo(), ...ngDevMode ? [{
    debugName: "$appendTo"
  }] : []);
  searchValue = "";
  searchTimeout;
  _processedItems;
  _model;
  pressTimer;
  hideCallback;
  matchMediaListener;
  query;
  queryMatches = signal(false, ...ngDevMode ? [{
    debugName: "queryMatches"
  }] : []);
  _componentStyle = inject(ContextMenuStyle);
  get visibleItems() {
    const processedItem = this.activeItemPath().find((p) => p.key === this.focusedItemInfo().parentKey);
    return processedItem ? processedItem.items : this.processedItems;
  }
  get processedItems() {
    if (!this._processedItems || !this._processedItems.length) {
      this._processedItems = this.createProcessedItems(this.model || []);
    }
    return this._processedItems;
  }
  get focusedItemId() {
    const focusedItem = this.focusedItemInfo();
    return focusedItem.item && focusedItem.item?.id ? focusedItem.item.id : focusedItem.index !== -1 ? `${this.id}${s(focusedItem.parentKey) ? "_" + focusedItem.parentKey : ""}_${focusedItem.index}` : null;
  }
  constructor(overlayService) {
    super();
    this.overlayService = overlayService;
    effect(() => {
      const path = this.activeItemPath();
      if (s(path)) {
        this.bindGlobalListeners();
      } else if (!this.visible()) {
        this.unbindGlobalListeners();
      }
    });
  }
  onInit() {
    this.id = this.id || s2("pn_id_");
    this.bindMatchMediaListener();
    this.bindTriggerEventListener();
  }
  isMobile() {
    return Ut() || $t();
  }
  bindTriggerEventListener() {
    if (isPlatformBrowser(this.platformId)) {
      if (!this.triggerEventListener) {
        if (!this.isMobile()) {
          if (this.global) {
            this.triggerEventListener = this.renderer.listen(this.document, this.triggerEvent, (event) => {
              this.show(event);
            });
          } else if (this.target) {
            this.triggerEventListener = this.renderer.listen(this.target, this.triggerEvent, (event) => {
              this.show(event);
            });
          }
        } else {
          if (this.global) {
            this.triggerEventListener = this.renderer.listen(this.document, "touchstart", this.onTouchStart.bind(this));
            this.touchEndListener = this.renderer.listen(this.document, "touchend", this.onTouchEnd.bind(this));
          } else if (this.target) {
            this.triggerEventListener = this.renderer.listen(this.target, "touchstart", this.onTouchStart.bind(this));
            this.touchEndListener = this.renderer.listen(this.target, "touchend", this.onTouchEnd.bind(this));
          }
        }
      }
    }
  }
  bindGlobalListeners() {
    if (isPlatformBrowser(this.platformId)) {
      if (!this.documentClickListener) {
        const documentTarget = this.el ? this.el.nativeElement.ownerDocument : "document";
        this.documentClickListener = this.renderer.listen(documentTarget, "click", (event) => {
          if (this.container?.offsetParent && this.isOutsideClicked(event) && !event.ctrlKey && event.button !== 2) {
            this.hide();
          }
        });
      }
      if (!this.resizeListener) {
        this.resizeListener = this.renderer.listen(this.document.defaultView, "resize", (event) => {
          this.hide();
        });
      }
    }
  }
  /**
   * Custom item template.
   * @group Templates
   */
  itemTemplate;
  /**
   * Custom submenu icon template.
   * @group Templates
   */
  submenuIconTemplate;
  templates;
  _submenuIconTemplate;
  _itemTemplate;
  onAfterContentInit() {
    this.templates?.forEach((item) => {
      switch (item.getType()) {
        case "submenuicon":
          this._submenuIconTemplate = item.template;
          break;
        case "item":
          this._itemTemplate = item.template;
          break;
        default:
          this._itemTemplate = item.template;
          break;
      }
    });
  }
  getPTOptions(key, item, index, id) {
    return this.ptm(key, {
      context: {
        item,
        index,
        focused: this.isItemFocused({
          index,
          item
        }),
        disabled: this.isItemDisabled(item)
      }
    });
  }
  isItemFocused(itemInfo) {
    return this.focusedItemInfo().index === itemInfo.index;
  }
  createProcessedItems(items, level = 0, parent = {}, parentKey = "") {
    const processedItems = [];
    items && items.forEach((item, index) => {
      const key = (parentKey !== "" ? parentKey + "_" : "") + index;
      const newItem = {
        item,
        index,
        level,
        key,
        parent,
        parentKey
      };
      newItem["items"] = this.createProcessedItems(item.items, level + 1, newItem, key);
      processedItems.push(newItem);
    });
    return processedItems;
  }
  bindMatchMediaListener() {
    if (isPlatformBrowser(this.platformId)) {
      if (!this.matchMediaListener) {
        const query = window.matchMedia(`(max-width: ${this.breakpoint})`);
        this.query = query;
        this.queryMatches.set(query.matches);
        this.matchMediaListener = () => {
          this.queryMatches.set(query.matches);
          this.cd.markForCheck();
        };
        query.addEventListener("change", this.matchMediaListener);
      }
    }
  }
  unbindMatchMediaListener() {
    if (this.matchMediaListener) {
      this.query.removeEventListener("change", this.matchMediaListener);
      this.matchMediaListener = null;
    }
  }
  getItemProp(item, name) {
    return item ? m(item[name]) : void 0;
  }
  getProccessedItemLabel(processedItem) {
    return processedItem ? this.getItemLabel(processedItem.item) : void 0;
  }
  getItemLabel(item) {
    return this.getItemProp(item, "label");
  }
  isProcessedItemGroup(processedItem) {
    return processedItem && s(processedItem.items);
  }
  isSelected(processedItem) {
    return this.activeItemPath().some((p) => p.key === processedItem.key);
  }
  isValidSelectedItem(processedItem) {
    return this.isValidItem(processedItem) && this.isSelected(processedItem);
  }
  isValidItem(processedItem) {
    return !!processedItem && !this.isItemDisabled(processedItem.item) && !this.isItemSeparator(processedItem.item);
  }
  isItemDisabled(item) {
    return this.getItemProp(item, "disabled");
  }
  isItemSeparator(item) {
    return this.getItemProp(item, "separator");
  }
  isItemMatched(processedItem) {
    return this.isValidItem(processedItem) && this.getProccessedItemLabel(processedItem).toLocaleLowerCase().startsWith(this.searchValue.toLocaleLowerCase());
  }
  isProccessedItemGroup(processedItem) {
    return processedItem && s(processedItem.items);
  }
  onItemClick(event) {
    const {
      processedItem
    } = event;
    const grouped = this.isProcessedItemGroup(processedItem);
    const selected = this.isSelected(processedItem);
    if (selected) {
      const {
        index,
        key,
        level,
        parentKey,
        item
      } = processedItem;
      this.activeItemPath.set(this.activeItemPath().filter((p) => key !== p.key && key.startsWith(p.key)));
      this.focusedItemInfo.set({
        index,
        level,
        parentKey,
        item
      });
      bt(this.rootmenu?.sublistViewChild?.nativeElement);
    } else {
      grouped ? this.onItemChange(event) : this.hide();
    }
  }
  onItemMouseEnter(event) {
    this.onItemChange(event, "hover");
  }
  onKeyDown(event) {
    const metaKey = event.metaKey || event.ctrlKey;
    switch (event.code) {
      case "ArrowDown":
        this.onArrowDownKey(event);
        break;
      case "ArrowUp":
        this.onArrowUpKey(event);
        break;
      case "ArrowLeft":
        this.onArrowLeftKey(event);
        break;
      case "ArrowRight":
        this.onArrowRightKey(event);
        break;
      case "Home":
        this.onHomeKey(event);
        break;
      case "End":
        this.onEndKey(event);
        break;
      case "Space":
        this.onSpaceKey(event);
        break;
      case "Enter":
        this.onEnterKey(event);
        break;
      case "Escape":
        this.onEscapeKey(event);
        break;
      case "Tab":
        this.onTabKey(event);
        break;
      case "PageDown":
      case "PageUp":
      case "Backspace":
      case "ShiftLeft":
      case "ShiftRight":
        break;
      default:
        if (!metaKey && J2(event.key)) {
          this.searchItems(event, event.key);
        }
        break;
    }
  }
  onArrowDownKey(event) {
    const itemIndex = this.focusedItemInfo().index !== -1 ? this.findNextItemIndex(this.focusedItemInfo().index) : this.findFirstFocusedItemIndex();
    this.changeFocusedItemIndex(event, itemIndex);
    event.preventDefault();
  }
  onArrowRightKey(event) {
    const processedItem = this.visibleItems[this.focusedItemInfo().index];
    const grouped = this.isProccessedItemGroup(processedItem);
    if (grouped) {
      this.onItemChange({
        originalEvent: event,
        processedItem
      });
      this.focusedItemInfo.set({
        index: -1,
        parentKey: processedItem.key,
        item: processedItem.item
      });
      this.searchValue = "";
      this.onArrowDownKey(event);
    }
    event.preventDefault();
  }
  onArrowUpKey(event) {
    if (event.altKey) {
      if (this.focusedItemInfo().index !== -1) {
        const processedItem = this.visibleItems[this.focusedItemInfo().index];
        const grouped = this.isProccessedItemGroup(processedItem);
        !grouped && this.onItemChange({
          originalEvent: event,
          processedItem
        });
      }
      this.hide();
      event.preventDefault();
    } else {
      const itemIndex = this.focusedItemInfo().index !== -1 ? this.findPrevItemIndex(this.focusedItemInfo().index) : this.findLastFocusedItemIndex();
      this.changeFocusedItemIndex(event, itemIndex);
      event.preventDefault();
    }
  }
  onArrowLeftKey(event) {
    const processedItem = this.visibleItems[this.focusedItemInfo().index];
    const parentItem = this.activeItemPath().find((p) => p.key === processedItem.parentKey);
    const root = l(processedItem.parent);
    if (!root) {
      this.focusedItemInfo.set({
        index: -1,
        parentKey: parentItem ? parentItem.parentKey : "",
        item: processedItem.item
      });
      this.searchValue = "";
      this.onArrowDownKey(event);
    }
    const activeItemPath = this.activeItemPath().filter((p) => p.parentKey !== this.focusedItemInfo().parentKey);
    this.activeItemPath.set(activeItemPath);
    event.preventDefault();
  }
  onHomeKey(event) {
    this.changeFocusedItemIndex(event, this.findFirstItemIndex());
    event.preventDefault();
  }
  onEndKey(event) {
    this.changeFocusedItemIndex(event, this.findLastItemIndex());
    event.preventDefault();
  }
  onSpaceKey(event) {
    this.onEnterKey(event);
  }
  onEscapeKey(event) {
    this.hide();
    const processedItem = this.findVisibleItem(this.findFirstFocusedItemIndex());
    const focusedItemInfo = this.focusedItemInfo();
    this.focusedItemInfo.set(__spreadProps(__spreadValues({}, focusedItemInfo), {
      index: this.findFirstFocusedItemIndex(),
      item: processedItem.item
    }));
    event.preventDefault();
  }
  onTabKey(event) {
    if (this.focusedItemInfo().index !== -1) {
      const processedItem = this.visibleItems[this.focusedItemInfo().index];
      const grouped = this.isProccessedItemGroup(processedItem);
      !grouped && this.onItemChange({
        originalEvent: event,
        processedItem
      });
    }
    this.hide();
  }
  onEnterKey(event) {
    if (this.focusedItemInfo().index !== -1) {
      const element = z(this.rootmenu?.el?.nativeElement, `li[id="${`${this.focusedItemId}`}"]`);
      const anchorElement = element && (z(element, '[data-pc-section="itemlink"]') || z(element, "a,button"));
      anchorElement ? anchorElement.click() : element && element.click();
      const processedItem = this.visibleItems[this.focusedItemInfo().index];
      const grouped = this.isProccessedItemGroup(processedItem);
      if (!grouped) {
        const focusedItemInfo = this.focusedItemInfo();
        this.focusedItemInfo.set(__spreadProps(__spreadValues({}, focusedItemInfo), {
          index: this.findFirstFocusedItemIndex()
        }));
      }
    }
    event.preventDefault();
  }
  onItemChange(event, type) {
    const {
      processedItem,
      isFocus
    } = event;
    if (l(processedItem)) return;
    const {
      index,
      key,
      level,
      parentKey,
      items
    } = processedItem;
    const grouped = s(items);
    const activeItemPath = this.activeItemPath().filter((p) => p.parentKey !== parentKey && p.parentKey !== key);
    if (grouped) {
      activeItemPath.push(processedItem);
      this.submenuVisible.set(true);
    }
    this.focusedItemInfo.set({
      index,
      level,
      parentKey,
      item: processedItem.item
    });
    isFocus && bt(this.rootmenu?.sublistViewChild?.nativeElement);
    if (type === "hover" && this.queryMatches()) {
      return;
    }
    this.activeItemPath.set(activeItemPath);
  }
  onMenuFocus(event) {
    this.focused = true;
    const focusedItemInfo = this.focusedItemInfo().index !== -1 ? this.focusedItemInfo() : {
      index: -1,
      level: 0,
      parentKey: "",
      item: null
    };
    this.focusedItemInfo.set(focusedItemInfo);
  }
  onMenuBlur(event) {
    this.focused = false;
    this.focusedItemInfo.set({
      index: -1,
      level: 0,
      parentKey: "",
      item: null
    });
    this.searchValue = "";
  }
  onBeforeEnter(event) {
    this.container = event.element;
    this.appendOverlay();
    this.moveOnTop();
    this.position();
    this.$attrSelector && this.container?.setAttribute(this.$attrSelector, "");
  }
  onAfterEnter() {
    this.bindGlobalListeners();
    bt(this.rootmenu?.sublistViewChild?.nativeElement);
  }
  onAfterLeave() {
    this.restoreOverlayAppend();
    this.onOverlayHide();
    this.handleSubmenuAfterLeave?.();
    this.render.set(false);
  }
  appendOverlay() {
    if (this.$appendTo() && this.$appendTo() !== "self") {
      if (this.$appendTo() === "body") {
        ut(this.document.body, this.container);
      } else {
        ut(this.$appendTo(), this.container);
      }
    }
  }
  restoreOverlayAppend() {
    if (this.container && this.$appendTo() !== "self") {
      this.el.nativeElement.appendChild(this.container);
    }
  }
  moveOnTop() {
    if (this.autoZIndex && this.container) {
      zindexutils.set("menu", this.container, this.baseZIndex + this.config.zIndex.menu);
    }
  }
  onOverlayHide() {
    this.unbindGlobalListeners();
    if (!this.cd.destroyed) {
      this.target = null;
    }
    if (this.container && this.autoZIndex) {
      zindexutils.clear(this.container);
    }
    this.container = null;
  }
  onTouchStart(event) {
    this.pressTimer = setTimeout(() => {
      this.show(event);
    }, this.pressDelay);
  }
  onTouchEnd() {
    clearTimeout(this.pressTimer);
  }
  hide() {
    this.visible.set(false);
    this.onHide.emit();
    this.hideCallback?.();
    this.activeItemPath.set([]);
    this.focusedItemInfo.set({
      index: -1,
      level: 0,
      parentKey: "",
      item: null
    });
  }
  toggle(event) {
    this.visible() ? this.hide() : this.show(event);
  }
  show(event) {
    this.activeItemPath.set([]);
    this.focusedItemInfo.set({
      index: -1,
      level: 0,
      parentKey: "",
      item: null
    });
    bt(this.rootmenu?.sublistViewChild?.nativeElement);
    this.pageX = event.pageX;
    this.pageY = event.pageY;
    this.onShow.emit();
    this.visible() ? this.position() : this.visible.set(true);
    this.render.set(true);
    event.stopPropagation();
    event.preventDefault();
  }
  position() {
    if (!this.document.scrollingElement || !this.container) return;
    let left = this.pageX + 1;
    let top = this.pageY + 1;
    let width = this.container.offsetParent ? this.container.offsetWidth : J(this.container);
    let height = this.container.offsetParent ? this.container.offsetHeight : G(this.container);
    let viewport = h();
    if (left + width - this.document.scrollingElement.scrollLeft > viewport.width) {
      left -= width;
    }
    if (top + height - this.document.scrollingElement.scrollTop > viewport.height) {
      top -= height;
    }
    if (left < this.document.scrollingElement.scrollLeft) {
      left = this.document.scrollingElement.scrollLeft;
    }
    if (top < this.document.scrollingElement.scrollTop) {
      top = this.document.scrollingElement.scrollTop;
    }
    this.container.style.left = left + "px";
    this.container.style.top = top + "px";
  }
  searchItems(event, char) {
    this.searchValue = (this.searchValue || "") + char;
    let itemIndex = -1;
    let matched = false;
    if (this.focusedItemInfo().index !== -1) {
      itemIndex = this.visibleItems.slice(this.focusedItemInfo().index).findIndex((processedItem) => this.isItemMatched(processedItem));
      itemIndex = itemIndex === -1 ? this.visibleItems.slice(0, this.focusedItemInfo().index).findIndex((processedItem) => this.isItemMatched(processedItem)) : itemIndex + this.focusedItemInfo().index;
    } else {
      itemIndex = this.visibleItems.findIndex((processedItem) => this.isItemMatched(processedItem));
    }
    if (itemIndex !== -1) {
      matched = true;
    }
    if (itemIndex === -1 && this.focusedItemInfo().index === -1) {
      itemIndex = this.findFirstFocusedItemIndex();
    }
    if (itemIndex !== -1) {
      this.changeFocusedItemIndex(event, itemIndex);
    }
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.searchValue = "";
      this.searchTimeout = null;
    }, 500);
    return matched;
  }
  findVisibleItem(index) {
    return s(this.visibleItems) ? this.visibleItems[index] : null;
  }
  findLastFocusedItemIndex() {
    const selectedIndex = this.findSelectedItemIndex();
    return selectedIndex < 0 ? this.findLastItemIndex() : selectedIndex;
  }
  findLastItemIndex() {
    return M(this.visibleItems, (processedItem) => this.isValidItem(processedItem));
  }
  findPrevItemIndex(index) {
    const matchedItemIndex = index > 0 ? M(this.visibleItems.slice(0, index), (processedItem) => this.isValidItem(processedItem)) : -1;
    return matchedItemIndex > -1 ? matchedItemIndex : index;
  }
  findNextItemIndex(index) {
    const matchedItemIndex = index < this.visibleItems.length - 1 ? this.visibleItems.slice(index + 1).findIndex((processedItem) => this.isValidItem(processedItem)) : -1;
    return matchedItemIndex > -1 ? matchedItemIndex + index + 1 : index;
  }
  findFirstFocusedItemIndex() {
    const selectedIndex = this.findSelectedItemIndex();
    return selectedIndex < 0 ? this.findFirstItemIndex() : selectedIndex;
  }
  findFirstItemIndex() {
    return this.visibleItems.findIndex((processedItem) => this.isValidItem(processedItem));
  }
  findSelectedItemIndex() {
    return this.visibleItems.findIndex((processedItem) => this.isValidSelectedItem(processedItem));
  }
  changeFocusedItemIndex(event, index) {
    const processedItem = this.findVisibleItem(index);
    const focusedItemInfo = this.focusedItemInfo();
    if (focusedItemInfo.index !== index) {
      this.focusedItemInfo.set(__spreadProps(__spreadValues({}, focusedItemInfo), {
        index,
        item: processedItem.item
      }));
      this.scrollInView();
    }
  }
  scrollInView(index = -1) {
    const id = index !== -1 ? `${this.id}_${index}` : this.focusedItemId;
    const element = z(this.rootmenu?.el?.nativeElement, `li[id="${id}"]`);
    if (element) {
      element.scrollIntoView && element.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    }
  }
  bindResizeListener() {
    if (isPlatformBrowser(this.platformId)) {
      if (!this.resizeListener) {
        this.resizeListener = this.renderer.listen(this.document.defaultView, "resize", (event) => {
          this.hide();
        });
      }
    }
  }
  isOutsideClicked(event) {
    return !(this.container?.isSameNode(event.target) || this.container?.contains(event.target));
  }
  unbindResizeListener() {
    if (this.resizeListener) {
      this.resizeListener();
      this.resizeListener = null;
    }
  }
  unbindGlobalListeners() {
    if (this.documentClickListener) {
      this.documentClickListener();
      this.documentClickListener = null;
    }
    if (this.documentTriggerListener) {
      this.documentTriggerListener();
      this.documentTriggerListener = null;
    }
    if (this.resizeListener) {
      this.resizeListener();
      this.resizeListener = null;
    }
    if (this.touchEndListener) {
      this.touchEndListener();
      this.touchEndListener = null;
    }
  }
  unbindTriggerEventListener() {
    if (this.triggerEventListener) {
      this.triggerEventListener();
      this.triggerEventListener = null;
    }
  }
  onDestroy() {
    this.unbindGlobalListeners();
    this.unbindTriggerEventListener();
    this.unbindMatchMediaListener();
    this.restoreOverlayAppend();
    this.onOverlayHide();
  }
  static ɵfac = function ContextMenu_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ContextMenu)(ɵɵdirectiveInject(OverlayService));
  };
  static ɵcmp = ɵɵdefineComponent({
    type: _ContextMenu,
    selectors: [["p-contextMenu"], ["p-contextmenu"], ["p-context-menu"]],
    contentQueries: function ContextMenu_ContentQueries(rf, ctx, dirIndex) {
      if (rf & 1) {
        ɵɵcontentQuery(dirIndex, _c5, 4)(dirIndex, _c6, 4)(dirIndex, PrimeTemplate, 4);
      }
      if (rf & 2) {
        let _t;
        ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx.itemTemplate = _t.first);
        ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx.submenuIconTemplate = _t.first);
        ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx.templates = _t);
      }
    },
    viewQuery: function ContextMenu_Query(rf, ctx) {
      if (rf & 1) {
        ɵɵviewQuery(_c7, 5);
      }
      if (rf & 2) {
        let _t;
        ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx.rootmenu = _t.first);
      }
    },
    inputs: {
      model: "model",
      triggerEvent: "triggerEvent",
      target: "target",
      global: [2, "global", "global", booleanAttribute],
      style: "style",
      styleClass: "styleClass",
      autoZIndex: [2, "autoZIndex", "autoZIndex", booleanAttribute],
      baseZIndex: [2, "baseZIndex", "baseZIndex", numberAttribute],
      id: "id",
      breakpoint: "breakpoint",
      ariaLabel: "ariaLabel",
      ariaLabelledBy: "ariaLabelledBy",
      pressDelay: [2, "pressDelay", "pressDelay", numberAttribute],
      appendTo: [1, "appendTo"],
      motionOptions: [1, "motionOptions"]
    },
    outputs: {
      onShow: "onShow",
      onHide: "onHide"
    },
    features: [ɵɵProvidersFeature([ContextMenuStyle, {
      provide: CONTEXTMENU_INSTANCE,
      useExisting: _ContextMenu
    }]), ɵɵInheritDefinitionFeature],
    decls: 1,
    vars: 1,
    consts: [["container", ""], ["rootmenu", ""], [3, "class", "style", "ngStyle", "pBind", "pMotion", "pMotionName", "pMotionAppear", "pMotionOptions"], [3, "pMotionOnBeforeEnter", "pMotionOnAfterEnter", "pMotionOnAfterLeave", "ngStyle", "pBind", "pMotion", "pMotionName", "pMotionAppear", "pMotionOptions"], [3, "itemClick", "menuFocus", "menuBlur", "menuKeydown", "itemMouseEnter", "root", "items", "itemTemplate", "menuId", "ariaLabel", "ariaLabelledBy", "baseZIndex", "autoZIndex", "visible", "focusedItemId", "activeItemPath", "pt", "unstyled", "motionOptions"]],
    template: function ContextMenu_Template(rf, ctx) {
      if (rf & 1) {
        ɵɵconditionalCreate(0, ContextMenu_Conditional_0_Template, 4, 25, "div", 2);
      }
      if (rf & 2) {
        ɵɵconditional(ctx.render() ? 0 : -1);
      }
    },
    dependencies: [CommonModule, NgStyle, ContextMenuSub, RouterModule, TooltipModule, Bind, BadgeModule, SharedModule, BindModule, MotionModule, MotionDirective],
    encapsulation: 2,
    changeDetection: 0
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ContextMenu, [{
    type: Component,
    args: [{
      selector: "p-contextMenu, p-contextmenu, p-context-menu",
      standalone: true,
      imports: [CommonModule, ContextMenuSub, RouterModule, TooltipModule, BadgeModule, SharedModule, BindModule, MotionModule],
      template: `
        @if (render()) {
            <div
                #container
                [attr.id]="id"
                [class]="cn(cx('root'), styleClass)"
                [style]="sx('root')"
                [ngStyle]="style"
                [pBind]="ptm('root')"
                [pMotion]="visible()"
                [pMotionName]="'p-anchored-overlay'"
                [pMotionAppear]="true"
                [pMotionOptions]="computedMotionOptions()"
                (pMotionOnBeforeEnter)="onBeforeEnter($event)"
                (pMotionOnAfterEnter)="onAfterEnter()"
                (pMotionOnAfterLeave)="onAfterLeave()"
            >
                <p-contextmenu-sub
                    #rootmenu
                    [root]="true"
                    [items]="processedItems"
                    [itemTemplate]="itemTemplate || _itemTemplate"
                    [menuId]="id"
                    [ariaLabel]="ariaLabel"
                    [ariaLabelledBy]="ariaLabelledBy"
                    [baseZIndex]="baseZIndex"
                    [autoZIndex]="autoZIndex"
                    [visible]="submenuVisible()"
                    [focusedItemId]="focused ? focusedItemId : undefined"
                    [activeItemPath]="activeItemPath()"
                    (itemClick)="onItemClick($event)"
                    (menuFocus)="onMenuFocus($event)"
                    (menuBlur)="onMenuBlur($event)"
                    (menuKeydown)="onKeyDown($event)"
                    (itemMouseEnter)="onItemMouseEnter($event)"
                    [pt]="pt()"
                    [unstyled]="unstyled()"
                    [motionOptions]="computedMotionOptions()"
                />
            </div>
        }
    `,
      changeDetection: ChangeDetectionStrategy.OnPush,
      encapsulation: ViewEncapsulation.None,
      providers: [ContextMenuStyle, {
        provide: CONTEXTMENU_INSTANCE,
        useExisting: ContextMenu
      }]
    }]
  }], () => [{
    type: OverlayService
  }], {
    model: [{
      type: Input
    }],
    triggerEvent: [{
      type: Input
    }],
    target: [{
      type: Input
    }],
    global: [{
      type: Input,
      args: [{
        transform: booleanAttribute
      }]
    }],
    style: [{
      type: Input
    }],
    styleClass: [{
      type: Input
    }],
    autoZIndex: [{
      type: Input,
      args: [{
        transform: booleanAttribute
      }]
    }],
    baseZIndex: [{
      type: Input,
      args: [{
        transform: numberAttribute
      }]
    }],
    id: [{
      type: Input
    }],
    breakpoint: [{
      type: Input
    }],
    ariaLabel: [{
      type: Input
    }],
    ariaLabelledBy: [{
      type: Input
    }],
    pressDelay: [{
      type: Input,
      args: [{
        transform: numberAttribute
      }]
    }],
    appendTo: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "appendTo",
        required: false
      }]
    }],
    motionOptions: [{
      type: Input,
      args: [{
        isSignal: true,
        alias: "motionOptions",
        required: false
      }]
    }],
    onShow: [{
      type: Output
    }],
    onHide: [{
      type: Output
    }],
    rootmenu: [{
      type: ViewChild,
      args: ["rootmenu"]
    }],
    itemTemplate: [{
      type: ContentChild,
      args: ["item", {
        descendants: false
      }]
    }],
    submenuIconTemplate: [{
      type: ContentChild,
      args: ["submenuicon", {
        descendants: false
      }]
    }],
    templates: [{
      type: ContentChildren,
      args: [PrimeTemplate]
    }]
  });
})();
var ContextMenuModule = class _ContextMenuModule {
  static ɵfac = function ContextMenuModule_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ContextMenuModule)();
  };
  static ɵmod = ɵɵdefineNgModule({
    type: _ContextMenuModule,
    imports: [ContextMenu, SharedModule],
    exports: [ContextMenu, SharedModule]
  });
  static ɵinj = ɵɵdefineInjector({
    imports: [ContextMenu, SharedModule, SharedModule]
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ContextMenuModule, [{
    type: NgModule,
    args: [{
      imports: [ContextMenu, SharedModule],
      exports: [ContextMenu, SharedModule]
    }]
  }], null, null);
})();
export {
  ContextMenu,
  ContextMenuClasses,
  ContextMenuModule,
  ContextMenuStyle,
  ContextMenuSub
};
//# sourceMappingURL=primeng_contextmenu.js.map
