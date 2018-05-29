import {Entity, PrimaryGeneratedColumn, Column} from "typeorm";

@Entity("mail_queue")
export class Mail_Queue {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_id: number;

    @Column()
    email_address: string;

    @Column()
    subject: string;

    @Column()
    html: string;
    
    @Column()
    datecreated: string;

}