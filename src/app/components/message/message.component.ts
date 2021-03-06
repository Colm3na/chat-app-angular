import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import io from 'socket.io-client';
import { TokenService } from 'src/app/services/token.service';
import { ActivatedRoute } from '@angular/router';
import { UsersService } from 'src/app/services/users.service';
import { MessageService } from 'src/app/services/message.service';
import { EmojiEvent, CaretEvent } from 'ng2-emoji-picker';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.css']
})
export class MessageComponent implements OnInit {

  @ViewChild('inputMsg') input: ElementRef;
  @ViewChild('chatBubble') chatBubble: ElementRef;
  socket: any;
  token: any;
  message: string;
  messageDB: any;
  messageID: string;
  messagesList: any = [];
  senderMsg: any = [];
  receiverMsg: any = [];
  user: any;
  sender: string;
  receiver: string;
  senderData: any;
  senderId: string;
  receiverData: any;
  receiverId: string;

  typing = false;
  timer = 0;
  typer: string;

  eventMock;
  eventPosMock;
  direction = Math.random() > 0.5 ? (Math.random() > 0.5 ? 'top' : 'bottom') : (Math.random() > 0.5 ? 'right' : 'left');
  toggled = false;
  content = ' ';

  private _lastCaretEvent: CaretEvent;

  constructor( private tokenService: TokenService, 
    private route: ActivatedRoute,
    private userService: UsersService,
    private messageService: MessageService ) { }

  ngOnInit() {
    // getting receiver info
    this.route.params.subscribe(params => {
      this.userService.getUser(params.receiverId).subscribe(data => {
        this.receiverData = data;
        this.receiver = this.receiverData[0].username;
        console.log('this.receiver is', this.receiver);
        this.receiverId = this.receiverData[0]._id;
      });
    })

    this.user = this.tokenService.getPayload();
    this.token = this.tokenService.getToken();

    let username = this.user.username;
    // getting sender info
    this.userService.getUserByUsername(username).subscribe( data => {
      this.senderData = data;
      this.sender = data[0].username;
      this.senderId = data[0]._id;

      // getting all chat messages
      this.messageService.getConversationMessages( this.senderData[0]._id, this.receiverData[0]._id ).subscribe( data => {
        console.log( 'messages', data );
        this.senderMsg = data[0][0];
        this.receiverMsg = data[1][0];
        let allMessages = this.senderMsg.concat(this.receiverMsg);
        // sort array of all messages according to createdAt property.
        let allMessagesSorted = allMessages.sort( (a, b) => {
          if ( a.createdAt < b.createdAt ) {
            return -1;
          } else if ( a.createdAt === b.createdAt ) {
            return 0;
          } else {
            return 1;
          }
        })
        this.messagesList = allMessagesSorted;
        
        console.log('messagesList after calling getAllMessages service', this.messagesList);
      })
    })

    // setting socket
    this.socket = io('http://localhost:3000', {
      query: {
        token: this.token
      }
    })

    this.socket.on('connect', () => {
      this.socket.id = this.user._id;
      // this timeout makes sure that first we get the room's name before the user can access it
      let timer = 0;
      setTimeout(() => {
        timer = 3;
        console.log('Going to launch enter chat. this.receiver is', this.receiver);
        this.socket.emit('enter chat', this.receiver)
      }, 500);

    })

    this.socket.on('entered chat', () => {
      this.messageService.set_all_messages_as_read(this.senderId, this.receiverId).subscribe( data => {
        console.log('All messages successfully set as read', data);
      });
    })

    this.socket.on('receive message', data => {
      console.log('!!!!!!!!! receive message activated');
      let newMessage = {
        id: data.id,
        body: data.body,
        createdAt: Date.now(),
        sender: data.sender,
        senderId: data.senderId,
        receiver: data.receiver,
        receiverId: data.receiverId,
      }

      // check to make conversation private using sender's and receiver's ids
      // check if it is receiver
      if ( this.sender !== newMessage.sender ) {
        if ( newMessage.senderId === this.receiverId && newMessage.receiverId === this.senderId ) {
          this.messagesList.push(newMessage);
          console.log('messagesList after receive message', this.messagesList);
        }
      // if it is sender 
      } else {
        if ( newMessage.senderId === this.senderId && newMessage.receiverId === this.receiverId ) {
          this.messagesList.push(newMessage);
          console.log('messagesList after receive message', this.messagesList);
        }
      }
    })

    this.socket.on('read message', data => {
      // check if user is talking to sender
      if ( data.sender === this.receiver) {
        // set message as read
        this.messageService.setMessageAsRead(data.id).subscribe( () => {
          console.log('message succesfully set to read');
        });
      }
    })

    this.socket.on('receive typing', data => {
      // quick fix. user typing only shows up if in the conversation window
      if ( data.sender === this.receiver ) {
        // console.log(data.sender, 'is typing');
        this.typing = data.val;
        if (data.sender) {
          this.typer = data.sender;
        }
      }
    })
  }

  ngAfterViewInit() {
    this.input.nativeElement.focus();
  }

  handleSelection(event: EmojiEvent) {
    this.content = '';
    this.content = this.content.slice(0, this._lastCaretEvent.caretOffset) + event.char + this.content.slice(this._lastCaretEvent.caretOffset);
    this.eventMock = JSON.stringify(event);
    this.message = this.content;

    this.toggled = !this.toggled;
    this.send();
  }

  handleCurrentCaret(event: CaretEvent) {
    this._lastCaretEvent = event;
    this.eventPosMock = `{ caretOffset : ${event.caretOffset}, caretRange: Range{...}, textContent: ${event.textContent} }`;
  }

  Toggled() {
    this.toggled = !this.toggled;
  }

  isTyping(sender, receiver, val) {
    this.socket.emit('typing', {sender, receiver, val});
  }

  send() {
    // with this if statement empty messages are prevented
    if ( this.input.nativeElement.value !== '' || this.message !== '' ) {
      // detect if string is a emoji
      let regex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|[\ud83c[\ude50\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;
      // if it is not a emoji then message will be the current input value
      if (!regex.test(this.message)) {
        this.message = this.input.nativeElement.value;
      }
      // set back input value to empty string
      this.input.nativeElement.value = '';
      // typing to false
      this.typing = false;
      // save chat message in DB
  
      this.messageDB = {
        body: this.message,
        sender: this.sender,
        senderId: this.senderData[0]._id,
        receiverId: this.receiverData[0]._id
      }
  
      this.messageService.sendMessage(this.senderData.id, this.receiverData.id, this.messageDB).subscribe( data => {
        this.messageID = data['id'];

        // emitting new message event
        this.socket.emit('new message', {
          id: this.messageID,
          sender: this.sender, 
          senderId: this.senderId, 
          receiver: this.receiver, 
          receiverId: this.receiverId, 
          body: this.message,
        });
        // assign empty value to this.message 
        this.message = '';
      })
    } 
  }

}