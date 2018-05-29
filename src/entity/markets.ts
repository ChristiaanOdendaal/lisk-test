import {Trades} from "./trades";
import {Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable} from "typeorm";
@Entity()
export class Markets {

	@PrimaryGeneratedColumn('int')
    market_id: number;
  @Column()
    coin: number;
  @ManyToMany(type => Trades) 
  @JoinTable()
  public trades: Trades[];
}