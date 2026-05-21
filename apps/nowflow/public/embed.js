/**
 * NowFlow Embed Widget
 *
 * Usage:
 *   <script src="https://your-domain.com/embed.js"></script>
 *   <script>
 *     NowFlow.init({
 *       chatId: 'your-chat-id',
 *       // OR
 *       formId: 'your-form-id',
 *       // Optional:
 *       position: 'bottom-right', // bottom-right, bottom-left
 *       theme: 'light', // light, dark, auto
 *       primaryColor: '#6366F1',
 *       title: 'Chat with us',
 *       subtitle: 'Ask anything',
 *       placeholder: 'Type your message...',
 *     });
 *   </script>
 */
;(function () {
  'use strict'

  var NowFlow = {
    _config: null,
    _iframe: null,
    _button: null,
    _container: null,
    _isOpen: false,

    init: function (config) {
      if (!config || (!config.chatId && !config.formId)) {
        console.error('NowFlow: chatId or formId is required')
        return
      }

      this._config = Object.assign(
        {
          position: 'bottom-right',
          theme: 'light',
          primaryColor: '#6366F1',
          title: 'Chat with us',
          subtitle: 'We typically reply within minutes',
          placeholder: 'Type your message...',
          buttonSize: 56,
          borderRadius: 16,
          zIndex: 99999,
        },
        config
      )

      this._injectStyles()
      this._createButton()
      this._createContainer()
    },

    open: function () {
      if (!this._container) return
      this._isOpen = true
      this._container.style.display = 'flex'
      this._button.querySelector('.nf-badge').style.display = 'none'
      setTimeout(
        function () {
          this._container.style.opacity = '1'
          this._container.style.transform = 'translateY(0) scale(1)'
        }.bind(this),
        10
      )
    },

    close: function () {
      if (!this._container) return
      this._isOpen = false
      this._container.style.opacity = '0'
      this._container.style.transform = 'translateY(10px) scale(0.95)'
      setTimeout(
        function () {
          this._container.style.display = 'none'
        }.bind(this),
        200
      )
    },

    toggle: function () {
      if (this._isOpen) {
        this.close()
      } else {
        this.open()
      }
    },

    _injectStyles: function () {
      var style = document.createElement('style')
      style.textContent =
        '.nf-widget-btn{position:fixed;cursor:pointer;border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.2s,box-shadow 0.2s;z-index:' +
        this._config.zIndex +
        '}.nf-widget-btn:hover{transform:scale(1.05);box-shadow:0 6px 20px rgba(0,0,0,0.2)}.nf-widget-container{position:fixed;display:none;flex-direction:column;border-radius:' +
        this._config.borderRadius +
        'px;box-shadow:0 8px 40px rgba(0,0,0,0.12);overflow:hidden;transition:opacity 0.2s,transform 0.2s;opacity:0;transform:translateY(10px) scale(0.95);z-index:' +
        this._config.zIndex +
        '}.nf-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 5px}'
      document.head.appendChild(style)
    },

    _createButton: function () {
      var cfg = this._config
      var btn = document.createElement('button')
      btn.className = 'nf-widget-btn'
      btn.style.width = cfg.buttonSize + 'px'
      btn.style.height = cfg.buttonSize + 'px'
      btn.style.backgroundColor = cfg.primaryColor
      btn.style[cfg.position === 'bottom-left' ? 'left' : 'right'] = '20px'
      btn.style.bottom = '20px'
      btn.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '<span class="nf-badge" style="background:' +
        cfg.primaryColor +
        ';color:white;display:none"></span>'
      btn.setAttribute('aria-label', 'Open chat')
      btn.addEventListener(
        'click',
        function () {
          this.toggle()
        }.bind(this)
      )

      document.body.appendChild(btn)
      this._button = btn
    },

    _createContainer: function () {
      var cfg = this._config
      var container = document.createElement('div')
      container.className = 'nf-widget-container'
      container.style.width = '380px'
      container.style.height = '560px'
      container.style[cfg.position === 'bottom-left' ? 'left' : 'right'] = '20px'
      container.style.bottom = cfg.buttonSize + 30 + 'px'
      container.style.backgroundColor = cfg.theme === 'dark' ? '#0F172A' : '#FFFFFF'
      container.style.border = '1px solid ' + (cfg.theme === 'dark' ? '#334155' : '#E2E8F0')

      var src = ''
      if (cfg.chatId) {
        src = window.location.origin + '/chat/' + cfg.chatId + '?embed=true&theme=' + cfg.theme
      } else if (cfg.formId) {
        src = window.location.origin + '/forms/' + cfg.formId + '?embed=true&theme=' + cfg.theme
      }

      var iframe = document.createElement('iframe')
      iframe.src = src
      iframe.style.width = '100%'
      iframe.style.height = '100%'
      iframe.style.border = 'none'
      iframe.setAttribute('allow', 'microphone; camera')
      iframe.setAttribute('title', cfg.title)

      container.appendChild(iframe)
      document.body.appendChild(container)
      this._container = container
      this._iframe = iframe
    },
  }

  // Expose to global scope
  window.NowFlow = NowFlow
})()
