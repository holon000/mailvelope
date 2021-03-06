/**
 * Mailvelope - secure email with OpenPGP encryption for Webmail
 * Copyright (C) 2012  Thomas Oberndörfer
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function() {

  var keyGridColumns = [
    {
      field: "type",
      title: " ",
      width: 30,
      template: '<img src="../img/#= type #-key.png" alt="#= type #" />'
    },
    {
      field: "name",
      title: "Name"
    },
    {
      field: "email",
      title: "Email"
    },
    {
      field: "id",
      width: 100,
      title: "Key ID",
      template: '#= id.substr(-8) #',
      attributes: {
        style: "font-family: monospace;"
      }
    },
    {
      field: "crDate",
      width: 90,
      title: "Creation",
      template: '#= kendo.toString(crDate,"dd.MM.yyyy") #'
    },
    {
      command: "destroy",
      title: " ",
      width: "100px"
    }
  ];

  var exDateField = {
    type: "date",
    parse: function(value) {
      return kendo.parseDate(value) || 'The key does not expire';
    }
  };

  var keyGridSchema = {
    model: {
      fields: {
        type: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        id: { type: "string" },
        crDate: { type: "date" },
        exDate: exDateField
      }
    }
  };

  var subKeySchema = {
    model: {
      fields: {
        crDate: { type: "date" },
        exDate: exDateField
      }
    }
  };

  var signerSchema = {
    model: {
      fields: {
        signer: { type: "string" },
        id: { type: "string" },
        crDate: { type: "date" }
      }
    }
  };

  // var attributeSchema = {
  //   model: {
  //     fields: {
  //       signer: { type: "string" },
  //       id: { type: "string" },
  //       crDate: { type: "date" }
  //     }
  //   }
  // };

  function init() {
    $('#displayKeys').addClass('spinner');
    keyRing.viewModel('getKeys', initGrid);
    keyRing.event.on('keygrid-reload', reload);
  }

  function reload() {
    keyRing.viewModel('getKeys', function(keys) {
      $("#mainKeyGrid").data("kendoGrid").setDataSource(new kendo.data.DataSource({
        data: keys,
        schema: keyGridSchema,
        change: onDataChange
      }));
    });
  }

  function initGrid(keys) {

    $('#displayKeys').removeClass('spinner');

    var grid = $("#mainKeyGrid").kendoGrid({
      columns: keyGridColumns,
      dataSource: {
        data: keys,
        schema: keyGridSchema,
        change: onDataChange
      },
      detailTemplate: kendo.template($("#keyDetails").html()),
      detailInit: loadDetails,
      selectable: "row",
      sortable: {
        mode: "multiple", // enables multi-column sorting
        allowUnsort: true
      },
      toolbar: kendo.template($("#keyToolbar").html()),
      editable: {
        update: false,
        destroy: true,
        confirmation: "Are you sure you want to remove this key?",
      },
      remove: onRemoveKey,
      change: onGridChange
    });

    function onRemoveKey(e) {
      keyRing.viewModel('removeKey', [e.model.guid, e.model.type]);
    }

    grid.find("#keyType").kendoDropDownList({
      dataTextField: "text",
      dataValueField: "value",
      autoBind: false,
      optionLabel: "All",
      dataSource: [
        { text: "Public Keys", value: "public" },
        { text: "Private Keys", value: "private" }
      ],
      change: onDropDownChange
    });

    $("#mainKeyGrid").triggerHandler('mainKeyGridReady');

    function onDropDownChange() {
      var value = this.value();
      if (value) {
        grid.data("kendoGrid").dataSource.filter({ field: "type", operator: "eq", value: value });
      } else {
        grid.data("kendoGrid").dataSource.filter({});
      }
    }

    function onGridChange(e) {
      var selected = this.select();
      if (selected.length !== 0) {
        $('#exportBtn').removeClass('disabled');
        var selKey = grid.data("kendoGrid").dataItem(selected);
        if (selKey.type === 'public') {
          $('#exportPrivate, #exportKeyPair').addClass('disabled');
        } else {
          $('#exportPrivate, #exportKeyPair').removeClass('disabled');
        }
        /*
        // keys longer than 1600 chars don't fit into URL
        console.log(selKey);
        if (selKey.armoredPublic.length > 1600) {
          $('#exportByMail').addClass('disabled');
        } else {
          $('#exportByMail').removeClass('disabled');
        }
        */
      } else {
        $('#exportBtn').addClass('disabled');
      }
    }

  }

  function onDataChange(e) {
    // selection is lost on data change, therefore disable export button
    $('#exportBtn').addClass('disabled');
    keyRing.event.triggerHandler('keygrid-data-change');
  }

  function loadDetails(e) {
    //console.log('loadDetails')
    e.detailRow.find(".tabstrip").kendoTabStrip({
      animation: {
        open: { effects: "fadeIn" }
      }
    });
    keyRing.viewModel('getKeyDetails', [e.data.guid], function(details) {
      //console.log('keyGrid key details received', details);
      e.data.subkeys = details.subkeys;
      e.data.users = details.users;
      e.data.attributes = details.attributes;
      detailInit(e);
    });
  }

  function detailInit(e) {
    //console.log('detailInit');
    var detailRow = e.detailRow;

    /* Subkeys */
    var subkeyID = detailRow.find(".subkeyID").kendoDropDownList({
      dataTextField: "id",
      dataValueField: "id",
      dataSource: {
        data: e.data.subkeys,
        schema: subKeySchema
      },
      select: onSubkeySelect,
      index: 0
    });

    var subkeyTemplate = kendo.template($("#subkeyDetails").html());
    var subkeyDetails = detailRow.find(".subkeyDetails");
    var firstSubKey = subkeyID.data("kendoDropDownList").dataItem(0); // e.data.subkeys[0] can't be used as dates are not mapped
    if (firstSubKey) {
      subkeyDetails.html(subkeyTemplate(firstSubKey));
    } else {
      subkeyDetails.html('<li>No subkeys available</li>');
    }

    function onSubkeySelect(e) {
      var dataItem = this.dataItem(e.item.index());
      subkeyDetails.html(subkeyTemplate(dataItem));
    }

    /* User IDs */
    var useridDdl = detailRow.find(".userID");

    useridDdl.width(300);
    useridDdl.kendoDropDownList({
      dataTextField: "userID",
      dataValueField: "userID",
      dataSource: e.data.users,
      select: onUserSelect,
      index: 0
    });

    detailRow.find(".signerGrid").kendoGrid({
      columns: [
        {
          field: "signer",
          title: "Signer Name"
        },
        {
          field: "id",
          width: 150,
          title: "Signer KeyID"
        },
        {
          field: "crDate",
          width: 90,
          title: "Created",
          template: '#= kendo.toString(crDate,"dd.MM.yyyy") #'
        }
      ],
      dataSource: {
        data: e.data.users[0].signatures,
        schema: signerSchema
      },
      sortable: true,
    });

    var signerGrid = detailRow.find(".signerGrid").data("kendoGrid");

    function onUserSelect(e) {
      var dataItem = this.dataItem(e.item.index());
      // not working as dates don't get formated:
      //signerGrid.dataSource.data(dataItem.signatures);
      signerGrid.setDataSource(new kendo.data.DataSource({
        data: dataItem.signatures,
        schema: signerSchema
      }));
    }

    /* Attributes */
    var attributeTag = detailRow.find(".attributeTag").kendoDropDownList({
      dataTextField: "tagName",
      dataValueField: "tag",
      dataSource: {
        data: e.data.attributes
        // schema: attributeSchema
      },
      select: onAttributeSelect,
      index: 0
    });

    var attributeTemplate = kendo.template($("#attributeDetails").html());
    var attributeDetails = detailRow.find(".attributeDetails");
    var firstAttribute = attributeTag.data("kendoDropDownList").dataItem(0); // e.data.attributes[0] can't be used as dates are not mapped
    console.log(firstAttribute);
    var content;

    function bytesToHex (bytes) {
      //  code taken from https://code.google.com/p/crypto-js/source/browse/branches/2.0.x/src/Crypto.js?spec=svn301&r=301#61
      for (var hex = [], i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xF).toString(16));
      }
      return hex.join("");
    }

    function base58_encode(bytes) {
      var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      var base = new BigInteger("58", 10);

      var positions = {};
      for (var i=0; i<alphabet.length; ++i) {
        positions[alphabet[i]] = i;
      }

      var bi = new BigInteger(bytesToHex(bytes), 16);
      var chars = [];

      while (bi.compareTo(base) >= 0) {
        var mod = bi.mod(base);
        chars.push(alphabet[mod.intValue()]);
        bi = bi.subtract(mod).divide(base);
      }

      chars.push(alphabet[bi.intValue()]);

      // Convert leading zeros too.
      for (var i=0; i<bytes.length; i++) {
        if (bytes[i] === 0) {
          chars.push(alphabet[0]);
        } else {
          break;
        }
      }

      return chars.reverse().join('');
    }

    function renderAttributeContent(attribute) {
      if (attribute.tag == 1 && attribute.data && attribute.data.dataUri) {
        return '<img alt="photo" src="' + attribute.data.dataUri + '">';
      } else if (attribute.tag == 100 && attribute.data && attribute.data.coin) {
        var coin;
        var address = base58_encode(attribute.data.value);
        switch (attribute.data.coin) {
          case '79f58f10-e5b8-4807-94e5-472a2a623f30':
            coin = 'bitcoin';
            break;
          default:
            coin = 'unknown';
        }
        
        var text = coin + ':' + address;
        var qr = qrcode(10, 'H');
        qr.addData(text);
        qr.make();
        var img = qr.createImgTag(4, 1);
        return '<a href="' + text + '" title="' + text + '">' + img + '</a>';
      } else if (attribute.data) {
        return '<pre>' + JSON.stringify(attribute.data) + '</pre>';
      } else {
        return attribute.content;
      }
    }

    if (firstAttribute) {
      var data = renderAttributeContent(firstAttribute);
      content = attributeTemplate({content: data});
    } else {
      content = '<em>No attributes available</em>';
    }
    attributeDetails.html(content);

    function onAttributeSelect(e) {
      var dataItem = this.dataItem(e.item.index());
      var data = renderAttributeContent(dataItem);
      attributeDetails.html(attributeTemplate({content: data}));
    }
  }

  $(document).ready(init);

}());
