
const $ = require('jquery');
const Emitter = require('@definejs/emitter');
const $Object = require('@definejs/object');
const $String = require('@definejs/string');
const $Style = require('@definejs/style');

const Sample = require('./Masker/Sample');
const Style = require('./Masker/Style');
const Meta = require('./Masker/Meta');


const mapper = new Map();


class Masker {
    /**
    * 构造器。
    */
    constructor(config) {
        config = $Object.deepAssign({}, exports.defaults, config);

        let emitter = new Emitter(this);
        let style = Style.get(config);

        let meta = Meta.create(config, {
            'sample': Sample,       //相应的 html 模板。
            'style': style,         //从配置中过滤出样式成员，并进行规范化处理，style 是一个 {}。
            'emitter': emitter,     //事件驱动器。
            'this': this,           //当前实例，方便内部使用。
        });


        mapper.set(this, meta);

        //对外暴露的属性。
        Object.assign(this, {
            'id': meta.id,
            '$': null,
        });

    }


    // /**
    // * 当前实例的 id。
    // * 也是最外层的 DOM 节点的 id。
    // */
    // id = '';

    // /**
    // * 当前组件最外层的 DOM 节点对应的 jQuery 实例。
    // * 必须在 render 之后才存在。
    // */
    // $ = null;

    /**
    * 渲染本组件。
    * 该方法会创建 DOM 节点，并且绑定事件，但没有调用 show()。
    * 该方法只需要调用一次。
    * 触发事件: `render`。
    */
    render() {
        let meta = mapper.get(this);

        //已经渲染过了。
        if (meta.$) {
            return;
        }


        //首次渲染

        let style = $Style.stringify(meta.style);

        let html = $String.format(meta.sample, {
            'id': meta.id,
            'style': style,
        });


        $(meta.container).append(html);

        this.$ = meta.$ = $(`#${meta.id}`);


        //根据是否指定了易消失来绑定事件，即点击 mask 层就隐藏。
        meta.bindVolatile(function () {
            let ok = meta.this.hide();

            //在 hide() 中明确返回 false 的，则取消关闭。
            if (ok === false) {
                return;
            }

            //先备份原来的 opacity
            let opacity = meta.$.css('opacity');

            //显示一个完全透明的层 200ms，防止点透。
            //并且禁用事件，避免触发 show 事件。
            meta.$.css('opacity', 0);
            meta.this.show({ quiet: true, });

            setTimeout(function () {
                meta.$.css('opacity', opacity);
                meta.$.hide();
            }, 200);
        });

        meta.emitter.fire('render');
    }

    /**
    * 显示遮罩层。
    * 触发事件: `show`。
    *   config = {
    *       quiet: false,   //是否触发 `show` 事件。 该选项仅开放给组件内部使用。
    *       duration: 0,    //要持续显示的时间，单位是毫秒。 如果不指定，则使用创建实例时的配置。
    *       fadeIn: 200,    //可选。 需要淡入的动画时间，如果不指定或为指定为 0，则禁用淡入动画。
    *   };
    */
    show(config = {}) {
        let meta = mapper.get(this);
        let duration = 'duration' in config ? config.duration : meta.duration;
        let fadeIn = 'fadeIn' in config ? config.fadeIn : meta.fadeIn;


        //尚未渲染。
        //首次渲染。
        if (!meta.$) {
            this.render();
        }


        if (duration) {
            setTimeout(function () {
                meta.this.hide();
            }, duration);
        }


        if (fadeIn) {
            meta.$.css('opacity', 0);
        }

        meta.$.show();

        if (fadeIn) {
            meta.$.animate({
                'opacity': meta.opacity,
            }, fadeIn);
        }

        //没有明确指定要使用安静模式，则触发事件。
        if (!config.quiet) {
            meta.emitter.fire('show');
        }

    }

    /**
    * 隐藏遮罩层。
    * 触发事件: `hide`。
    * 如果在 hide 事件中明确返回 false，则取消隐藏。
    *   config = {
    *       fadeOut: 200,    //可选。 需要淡出的动画时间，如果不指定或为指定为 0，则禁用淡出动画。
    *   };
    */
    hide(config = {}) {
        let meta = mapper.get(this);
        let fadeOut = 'fadeOut' in config ? config.fadeOut : meta.fadeOut;

        //尚未渲染。
        if (!meta.$) {
            return;
        }

        let values = meta.emitter.fire('hide');

        //明确返回 false 的，则取消关闭。
        if (values.includes(false)) {
            return false;
        }

        if (fadeOut) {
            meta.$.animate({
                'opacity': 0,
            }, fadeOut, function () {
                meta.$.css('opacity', meta.opacity);
                meta.$.hide();
            });
        }
        else {
            meta.$.hide();
        }
    }

    /**
    * 移除本组件已生成的 DOM 节点。
    * 触发事件: `remove`。
    */
    remove() {
        let meta = mapper.get(this);

        //尚未渲染。
        if (!meta.$) {
            return;
        }

        let div = meta.$.get(0);
        div.parentNode.removeChild(div);

        meta.$.off();

        this.$ = meta.$ = null;
        meta.emitter.fire('remove');
    }

    /**
    * 绑定事件。
    */
    on(...args) {
        let meta = mapper.get(this);
        meta.emitter.on(...args);
    }

    /**
    * 销毁本组件
    */
    destroy() {
        let meta = mapper.get(this);

        this.remove();
        meta.emitter.destroy();

        mapper.delete(this);
    }


    /**
    * 把配置参数规格化。
    * 已重载 normalize(0, 0);              //任意一个为数字，则当成透明度。 如果都为数字，则使用后者的。   
    * 已重载 normalize(defaults, false);   //第二个参数显式指定了要禁用 mask，返回 null。
    * 已重载 normalize({}, {});
    */
    static normalize(defaults, config) {

        //第二个参数显式指定了要禁用 mask。
        if (config === false) {
            return null;
        }


        //输入的是数字，则当成是透明度。
        if (typeof defaults == 'number') { //透明度
            defaults = { 'opacity': defaults };
        }

        if (typeof config == 'number') { //透明度
            config = { 'opacity': config };
        }


        let type0 = typeof defaults;
        let type1 = typeof config;

        if (type0 == 'object' && type1 == 'object') {
            return Object.assign({}, defaults, config);
        }


        //显式指定使用 mask。
        //如果 defaults 没有，则显式分配一个。
        if (config === true) {
            return !defaults || type0 != 'object' ? {} : defaults;
        }


        //未指定，则使用默认配置指定的，有或没有
        if (config === undefined) {
            return type0 == 'object' ? defaults :
                defaults ? {} : null;
        }

        return type1 == 'object' ? config :
            config ? {} : null;
    }
}

Masker.defaults = require('./Masker.defaults');
module.exports = exports = Masker;