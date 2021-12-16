import {DefaultCrudRepository, EntityNotFoundError} from '@loopback/repository';
import {Message} from 'amqplib';
import {pick} from 'lodash';

interface SyncOptions{
  repo: DefaultCrudRepository<any,any>;
  data: any;
  message: Message
}

interface SyncRelationOptions{
  id: string;
  relation: string;
  relationIds: string[];
  repoRelation: DefaultCrudRepository<any,any>;
  repo: DefaultCrudRepository<any,any>;
}

export abstract class BaseModelSyncService {
  constructor(){
  }

  protected async sync({repo, data, message}: SyncOptions){
    const {id} = data || {}
    const action = this.getAction(message)
    const entity = this.createEntity(data, repo);

    switch(action){
      case 'created':
        repo.create(entity)
        break;
      case 'updated':
        await this.updateOrCreate({repo, id, entity});
        break;
      case 'delete':
        await repo.deleteById(id);
        break;
    }
  }

  protected getAction(message: Message){
    return message.fields.routingKey.split('.')[2]
  }

  protected createEntity(data: any, repo: DefaultCrudRepository<any,any>){
    return pick(data, Object.keys(repo.entityClass.definition.properties))
  }

  protected async updateOrCreate({repo, id, entity}: {repo: DefaultCrudRepository<any,any>, id: string, entity: any}){
    const exists = await repo.exists(id);

    return exists ? repo.updateById(id, entity) : repo.create(entity);
  }

  async syncRelations({id, relation, relationIds, repoRelation, repo}: SyncRelationOptions){ //[1,2,5,6]
    let collection = await repoRelation.find({
      where: {
        or: relationIds.map(relationId => ({id: relationId}))
      }
    })

    if(!collection.length){
      const error = new EntityNotFoundError(repoRelation.entityClass, relationIds)
      error.name = "EntityNotFound"
      throw error;
    }

    await repo.updateById(id, {[relation]: collection})


  }



}
